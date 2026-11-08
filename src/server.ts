import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
    if (url.pathname === "/~oauth/initiate") {
      const provider = url.searchParams.get("provider") || "google";
      const redirectUri = url.searchParams.get("redirect_uri") || `${url.origin}/`;
      const supabaseUrl = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];

      if (supabaseUrl && provider === "google") {
        return Response.redirect(
          `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUri)}`,
          302,
        );
      }

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>WholesaleIQ Authentication</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #FFF9F6; color: #2D1810; text-align: center; padding: 24px; box-sizing: border-box; }
    .card { background: white; border: 1px solid #E5D5D0; border-radius: 12px; padding: 32px 24px; max-width: 400px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
    h2 { margin: 0 0 12px; font-size: 20px; color: #8F454E; }
    p { margin: 0 0 20px; font-size: 14px; line-height: 1.5; color: #665; }
    button { background: #C96F78; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; }
  </style>
</head>
<body>
  <div class="card">
    <h2>WholesaleIQ Sign-in</h2>
    <p>Please use Email and Password sign-in on the main window.</p>
    <button onclick="window.close()">Return to WholesaleIQ</button>
  </div>
</body>
</html>`;
      return new Response(html, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
