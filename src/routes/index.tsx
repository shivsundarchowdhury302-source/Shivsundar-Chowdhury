import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "WholesaleIQ — Wholesale Intelligence Platform" },
      {
        name: "description",
        content:
          "Sales, credit, margin and pricing intelligence for a wholesale grocery distributor.",
      },
      { property: "og:title", content: "WholesaleIQ — Wholesale Intelligence Platform" },
      {
        property: "og:description",
        content:
          "Sales, credit, margin and pricing intelligence for wholesale grocery distribution.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/customers", replace: true });
  }, [navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Loading WholesaleIQ…
    </div>
  );
}
