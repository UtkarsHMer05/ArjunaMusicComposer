"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "~/lib/auth";
import { db } from "~/server/db";
import { unstable_noStore as noStore } from "next/cache";
import { Coins } from "lucide-react";

export async function Credits() {
  // Ensure this component is never cached so credits update immediately after webhook
  noStore();
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) return null;

  const user = await db.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { credits: true },
  });

  return (
    <div className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border bg-muted/40 px-3 text-xs leading-none">
      <Coins className="h-3.5 w-3.5 text-amber-500" />
      <span className="font-semibold tabular-nums">{user.credits}</span>
      <span className="text-muted-foreground">credits</span>
    </div>
  );
}
