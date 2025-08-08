import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "~/server/db";
import { Polar } from "@polar-sh/sdk";
import { env } from "~/env";
import {
  polar,
  checkout,
  portal,
  usage,
  webhooks,
} from "@polar-sh/better-auth";

const polarClient = new Polar({
  accessToken: env.POLAR_ACCESS_TOKEN,
  server: "sandbox",
});

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    polar({
      client: polarClient,
      createCustomerOnSignUp: true,
      use: [
        checkout({
          products: [
            {
              productId: "d081fc91-8d55-43a3-bb57-d3b39f934b02",
              slug: "small",
            },
            {
              productId: "e223246e-7573-433c-a59f-ff4aff8647f7",
              slug: "medium",
            },
            {
              productId: "bbd28aea-a6c2-4f44-a092-a48ef32f3dc9",
              slug: "large",
            },
          ],
          successUrl: "/",
          authenticatedUsersOnly: true,
        }),
        portal(),
        webhooks({
          secret: env.POLAR_WEBHOOK_SECRET,
          onOrderPaid: async (order) => {
            try {
              console.log("[POLAR] onOrderPaid event received");
              const d: any = order.data as any;
              console.log("[POLAR] Raw keys sample", Object.keys(d).slice(0, 15));

              // Support both camelCase and snake_case field names
              const externalCustomerId = d.customer?.externalId || d.customer?.external_id;
              if (!externalCustomerId) {
                console.error("[POLAR] Missing externalCustomerId (externalId/external_id)", d.customer);
                return;
              }

              const possibleProductIds: (string | undefined)[] = [
                d.productId,
                d.product_id,
                d.product?.id,
                d.product?.product_id,
                d.productPrice?.productId,
                d.productPrice?.product_id,
                d.productPriceId,
                d.product_price_id,
                d.orderItems?.[0]?.productId,
                d.orderItems?.[0]?.product_id,
                d.orderItems?.[0]?.product?.id,
                d.items?.[0]?.product_id, // snake_case items array per sample payload
              ];
              const rawProductId = possibleProductIds.find((v) => typeof v === "string");
              console.log("[POLAR] Resolved product identifier=", rawProductId);

              let creditsToAdd = 0;
              switch (rawProductId) {
                case "d081fc91-8d55-43a3-bb57-d3b39f934b02":
                  creditsToAdd = 10;
                  break;
                case "e223246e-7573-433c-a59f-ff4aff8647f7":
                  creditsToAdd = 25;
                  break;
                case "bbd28aea-a6c2-4f44-a092-a48ef32f3dc9":
                  creditsToAdd = 50;
                  break;
                default:
                  console.error("[POLAR] Unknown product id", rawProductId);
              }

              if (creditsToAdd === 0) return;

              // Try update by external customer id first
              try {
                const updated = await db.user.update({
                  where: { id: externalCustomerId },
                  data: { credits: { increment: creditsToAdd } },
                  select: { id: true, credits: true },
                });
                console.log(
                  `[POLAR] Credits +${creditsToAdd} for user ${updated.id}. New balance=`,
                  updated.credits,
                );
              } catch (errById) {
                console.warn(
                  "[POLAR] No user by externalCustomerId, trying by email...",
                  d.customer?.email,
                );
                if (d.customer?.email) {
                  try {
                    const updatedByEmail = await db.user.update({
                      where: { email: d.customer.email },
                      data: { credits: { increment: creditsToAdd } },
                      select: { id: true, credits: true, email: true },
                    });
                    console.log(
                      `[POLAR] Credits +${creditsToAdd} for user ${updatedByEmail.id} (email fallback ${updatedByEmail.email}). New balance=`,
                      updatedByEmail.credits,
                    );
                  } catch (errByEmail) {
                    console.error(
                      "[POLAR] Failed to add credits by id and email",
                      { errById, errByEmail },
                    );
                  }
                } else {
                  console.error(
                    "[POLAR] Missing customer email; cannot fallback update",
                  );
                }
              }
            } catch (e) {
              console.error("[POLAR] onOrderPaid error", e);
            }
          },
        }),
      ],
    }),
  ],
});