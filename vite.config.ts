// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      {
        name: "oauth-initiate-broker-handler",
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url && (req.url.startsWith("/~oauth") || req.url.includes("~oauth"))) {
              const parsed = new URL(req.url, "http://localhost:3000");
              const provider = parsed.searchParams.get("provider") || "google";
              const redirectUri = parsed.searchParams.get("redirect_uri") || "/";
              const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];

              if (supabaseUrl && provider === "google") {
                const target = `${supabaseUrl.replace(/\/+$/, "")}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUri)}`;
                res.writeHead(302, { Location: target });
                res.end();
                return;
              }

              res.setHeader("Content-Type", "text/html; charset=utf-8");
              res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>WholesaleIQ Authentication</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #FFF9F6; color: #2D1810; text-align: center; padding: 24px; box-sizing: border-box; }
    .card { background: white; border: 1px solid #E5D5D0; border-radius: 12px; padding: 32px 24px; max-width: 420px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
    h2 { margin: 0 0 12px; font-size: 20px; color: #8F454E; }
    p { margin: 0 0 20px; font-size: 14px; line-height: 1.5; color: #665; }
    button { background: #C96F78; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: background 0.15s; }
    button:hover { background: #B85F68; }
  </style>
</head>
<body>
  <div class="card">
    <h2>WholesaleIQ Sign-in</h2>
    <p>Please return to the WholesaleIQ main window and sign in using your Email &amp; Password or Google account.</p>
    <button onclick="window.close()">Close window</button>
  </div>
</body>
</html>`);
              return;
            }
            next();
          });
        },
      },
    ],
  },
});
