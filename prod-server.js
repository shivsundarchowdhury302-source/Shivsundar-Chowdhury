import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = "0.0.0.0";
const ROOT_DIR = process.cwd();
const DIST_DIR = path.join(ROOT_DIR, "dist");
const FALLBACK_HTML = path.join(DIST_DIR, "index.html");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".csv": "text/csv; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

const INTENTS = [
  "customer_profit",
  "customer_decline",
  "outstanding",
  "overdue",
  "credit_limits",
  "ageing",
  "product_profit",
  "product_margin",
  "best_selling",
  "product_compare",
  "below_cost",
  "price_history",
  "market_compare",
  "supplier_purchases",
  "expense_summary",
  "net_performance",
  "inventory",
  "exposure",
  "unsupported",
];

async function handleGeminiInterpretation(bodyText) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const { GoogleGenAI, Type } = await import("@google/genai");
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { "User-Agent": "aistudio-build" },
      },
    });

    const parsed = JSON.parse(bodyText);
    const { question, previousQuestion, today = new Date().toISOString().slice(0, 10) } = parsed;

    const prompt = `Interpret a read-only WholesaleIQ business analytics question. Today is ${today}. Never calculate figures or hallucinate. Return a JSON plan only.
Allowed intents: ${INTENTS.join(", ")}.
Use "unsupported" for requests to modify data or for questions unrelated to business, customers, products, credit, or pricing.
Dates must be inclusive ISO dates (YYYY-MM-DD); null means default period (last 90 days).
customer and product are literal name or code filters (e.g. "sugar", "maida", "Maa Tara Bhandar"), null if absent.
drop is rupees per kg price drop number, null if absent.
Question: "${question}"
Previous question context: "${previousQuestion ?? "none"}"`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["intent", "from", "to", "product", "customer", "drop"],
          properties: {
            intent: {
              type: Type.STRING,
              enum: [...INTENTS],
            },
            from: { type: Type.STRING },
            to: { type: Type.STRING },
            product: { type: Type.STRING },
            customer: { type: Type.STRING },
            drop: { type: Type.NUMBER },
          },
        },
      },
    });

    const text = response.text?.trim();
    if (!text) return null;
    return JSON.parse(text);
  } catch (err) {
    console.warn("Server Gemini interpretation error:", err);
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  const method = req.method || "GET";
  const parsedUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // 1. Health check endpoint for Cloud Run
  if (pathname === "/health" || pathname === "/_health" || pathname === "/ping") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("OK");
    return;
  }

  // 2. Handle POST /api/assistant/interpret
  if (method === "POST" && pathname === "/api/assistant/interpret") {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", async () => {
      try {
        const plan = await handleGeminiInterpretation(raw);
        if (plan) {
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify(plan));
        } else {
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ intent: "unsupported" }));
        }
      } catch {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ intent: "unsupported" }));
      }
    });
    return;
  }

  // Method check for static assets
  if (method !== "GET" && method !== "HEAD") {
    res.writeHead(405, { "Content-Type": "text/plain" });
    res.end("Method Not Allowed");
    return;
  }

  // 3. OAuth initiate broker
  if (pathname === "/~oauth/initiate" || pathname.startsWith("/~oauth")) {
    const provider = parsedUrl.searchParams.get("provider") || "google";
    const redirectUri = parsedUrl.searchParams.get("redirect_uri") || "/";
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;

    if (supabaseUrl && provider === "google") {
      const target = `${supabaseUrl.replace(/\/+$/, "")}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUri)}`;
      res.writeHead(302, { Location: target });
      res.end();
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>WholesaleIQ Authentication</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #FFF9F6; color: #2D1810; text-align: center; padding: 24px; }
    .card { background: white; border: 1px solid #E5D5D0; border-radius: 12px; padding: 32px 24px; max-width: 420px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
    h2 { margin: 0 0 12px; color: #8F454E; }
    button { background: #C96F78; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="card">
    <h2>WholesaleIQ Sign-in</h2>
    <p>Please return to the application window to sign in.</p>
    <button onclick="window.close()">Close window</button>
  </div>
</body>
</html>`);
    return;
  }

  // 4. Resolve static file in dist
  let filePath = path.join(DIST_DIR, pathname);

  // Security: prevent directory traversal
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Forbidden");
    return;
  }

  // If path is a directory or root, look for index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  // If file doesn't exist, check whether it has an extension (missing asset) or is an SPA route
  if (!fs.existsSync(filePath)) {
    const hasExtension = path.extname(pathname) !== "";
    if (hasExtension) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Asset not found");
      return;
    }
    // SPA route fallback to dist/index.html
    filePath = FALLBACK_HTML;
  }

  // Fallback check if dist/index.html doesn't exist
  if (!fs.existsSync(filePath)) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!DOCTYPE html>
<html>
<head><title>WholesaleIQ</title></head>
<body><div id="root">Loading WholesaleIQ...</div></body>
</html>`);
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const stat = fs.statSync(filePath);

  const headers = {
    "Content-Type": contentType,
    "Content-Length": stat.size,
    "Cache-Control":
      ext === ".html" ? "no-cache, must-revalidate" : "public, max-age=31536000, immutable",
  };

  // Support gzip compression for text/js/css/json
  const acceptEncoding = req.headers["accept-encoding"] || "";
  if (
    acceptEncoding.includes("gzip") &&
    (contentType.startsWith("text/") ||
      contentType.includes("javascript") ||
      contentType.includes("json") ||
      contentType.includes("xml"))
  ) {
    const rawStream = fs.createReadStream(filePath);
    const gzip = zlib.createGzip();
    headers["Content-Encoding"] = "gzip";
    delete headers["Content-Length"];

    res.writeHead(200, headers);
    rawStream.pipe(gzip).pipe(res);
    return;
  }

  res.writeHead(200, headers);
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`WholesaleIQ production server running on http://${HOST}:${PORT}`);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  server.close(() => process.exit(0));
});
