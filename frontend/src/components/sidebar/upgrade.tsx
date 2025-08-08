"use client";

import { authClient } from "~/lib/auth-client";
import { Button } from "../ui/button";

export default function Upgrade() {
  const upgrade = async () => {
    await authClient.checkout({
      products: [
        "d081fc91-8d55-43a3-bb57-d3b39f934b02",
        "e223246e-7573-433c-a59f-ff4aff8647f7",
        "bbd28aea-a6c2-4f44-a092-a48ef32f3dc9",
      ],
    });
  };
  return (
    <Button
      variant="outline"
      size="sm"
      className="ml-2 cursor-pointer text-orange-400"
      onClick={upgrade}
    >
      Upgrade
    </Button>
  );
}
