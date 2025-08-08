"use client";

import { Loader2, ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { authClient } from "~/lib/auth-client";

export default function CustomerPortalRedirect() {
  const [showBackButton, setShowBackButton] = useState(false);

  useEffect(() => {
    const portal = async () => {
      try {
        console.log("Calling portal with return URL:", `${window.location.origin}/`);

        // Show back button after a delay in case the redirect doesn't happen immediately
        const backButtonTimer = setTimeout(() => {
          setShowBackButton(true);
        }, 3000);

        const result = await authClient.customer.portal();

        // If the result contains a URL, modify it to include return parameters
        if (result && typeof result === 'string' && (result as string).includes('polar')) {
          const url = new URL(result as string);
          url.searchParams.set('return_url', `${window.location.origin}/`);
          window.location.href = url.toString();
          return;
        }

        console.log("Portal result:", result);

        // Clear the timer if redirect happens quickly
        clearTimeout(backButtonTimer);

      } catch (error) {
        console.error("Portal error:", error);
        setShowBackButton(true);
      }
    };
    void portal();
  }, []);

  const handleBackClick = () => {
    window.location.href = "/";
  };

  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-muted-foreground">
            Loading customer portal...
          </span>
        </div>

        {showBackButton && (
          <button
            onClick={handleBackClick}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </button>
        )}

        <div className="text-xs text-muted-foreground text-center max-w-md">
          If you&apos;re not automatically redirected, you can click the back button above or manually navigate back to the home page.
        </div>
      </div>
    </div>
  );
}
