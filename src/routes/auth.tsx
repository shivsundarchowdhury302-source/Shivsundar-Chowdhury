import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — WholesaleIQ" },
      {
        name: "description",
        content: "Sign in to WholesaleIQ to view sales, credit and pricing intelligence.",
      },
      { property: "og:title", content: "Sign in — WholesaleIQ" },
      { property: "og:description", content: "Secure access for owners, management and staff." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({ to: "/customers", replace: true });
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="flex items-center gap-2 font-display text-2xl font-semibold text-primary">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-success text-success-foreground">
          W
        </span>{" "}
        WholesaleIQ
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Redirecting to WholesaleIQ…</p>
      <Button className="mt-4" onClick={() => navigate({ to: "/customers", replace: true })}>
        Go to Customers
      </Button>
    </div>
  );
}
