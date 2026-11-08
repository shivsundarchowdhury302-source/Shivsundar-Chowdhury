import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const outputPublicDir = path.join(rootDir, ".output", "public");
const outputServerDir = path.join(rootDir, ".output", "server");
const distDir = path.join(rootDir, "dist");

// 1. Ensure fresh dist directory
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// 2. Copy static public assets if public folder exists
const publicDir = path.join(rootDir, "public");
if (fs.existsSync(publicDir)) {
  fs.cpSync(publicDir, distDir, { recursive: true });
}

// 3. Copy all files from .output/public into dist/
if (fs.existsSync(outputPublicDir)) {
  fs.cpSync(outputPublicDir, distDir, { recursive: true });
}

// 4. Also copy .output/server into dist/server
if (fs.existsSync(outputServerDir)) {
  fs.cpSync(outputServerDir, path.join(distDir, "server"), { recursive: true });
}

// 5. Find the latest generated CSS file and main index JS file in dist/assets
const assetsDir = path.join(distDir, "assets");
let cssFile = "";
let jsFile = "";

if (fs.existsSync(assetsDir)) {
  const files = fs.readdirSync(assetsDir);
  const cssFiles = files
    .filter((f) => f.startsWith("styles-") && f.endsWith(".css"))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(assetsDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  const jsFiles = files
    .filter((f) => f.startsWith("index-") && f.endsWith(".js"))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(assetsDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  if (cssFiles.length > 0) cssFile = `/assets/${cssFiles[0].name}`;
  if (jsFiles.length > 0) jsFile = `/assets/${jsFiles[0].name}`;
}

// 6. Generate valid dist/index.html so artifact upload and static servers can serve WholesaleIQ
const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>WholesaleIQ — Customer, Credit &amp; Pricing Intelligence</title>
  <meta name="description" content="Customer intelligence, credit management and pricing analytics for wholesale grocery distribution."/>
  <meta property="og:title" content="WholesaleIQ"/>
  <meta property="og:description" content="Customer intelligence, credit management and pricing analytics for wholesale distributors."/>
  <meta property="og:type" content="website"/>
  <link rel="icon" href="/favicon.ico" type="image/x-icon"/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous"/>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&amp;family=IBM+Plex+Mono:wght@400;500;600&amp;family=IBM+Plex+Sans:wght@400;500;600&amp;display=swap"/>
  ${cssFile ? `<link rel="stylesheet" href="${cssFile}"/>` : ""}
</head>
<body>
  <div id="root"></div>
  ${jsFile ? `<script type="module" src="${jsFile}"></script>` : ""}
</body>
</html>
`;

fs.writeFileSync(path.join(distDir, "index.html"), htmlContent, "utf8");

// Also write a 404.html fallback for SPA routers that support clean client-side routing on static hosting
fs.writeFileSync(path.join(distDir, "404.html"), htmlContent, "utf8");

console.log("Successfully prepared dist/ with valid build artifacts and index.html");
