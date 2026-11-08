import { StrictMode, startTransition } from "react";
import { hydrateRoot, createRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import "@/styles.css";

function mountApp() {
  const hasSsr =
    typeof window !== "undefined" &&
    Boolean((window as unknown as { $_TSR?: { router?: unknown } }).$_TSR?.router);

  startTransition(() => {
    if (hasSsr) {
      hydrateRoot(
        document,
        <StrictMode>
          <StartClient />
        </StrictMode>,
      );
    } else {
      let rootElement = document.getElementById("root");
      if (!rootElement) {
        rootElement = document.createElement("div");
        rootElement.id = "root";
        document.body.appendChild(rootElement);
      }
      if (!rootElement.hasAttribute("data-mounted")) {
        rootElement.setAttribute("data-mounted", "true");
        const router = getRouter();
        const root = createRoot(rootElement);
        root.render(
          <StrictMode>
            <RouterProvider router={router} />
          </StrictMode>,
        );
      }
    }
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountApp);
  } else {
    mountApp();
  }
}
