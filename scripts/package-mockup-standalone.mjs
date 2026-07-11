#!/usr/bin/env node
/**
 * Builds dist/helix-mockup-standalone — static Helix UI mockup only (no API/DB).
 * Optionally creates dist/helix-mockup-standalone.zip for email/USB sharing.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const srcDir = path.join(root, "backend", "public", "mockup");
const outDir = path.join(root, "dist", "helix-mockup-standalone");
const zipPath = path.join(root, "dist", "helix-mockup-standalone.zip");

function shouldCopy(sourcePath) {
  const rel = path.relative(srcDir, sourcePath);
  if (!rel || rel === ".") return true;
  const norm = rel.split(path.sep).join("/");
  if (norm === "scripts" || norm.startsWith("scripts/")) return false;
  return true;
}

const readme = `# Helix UI mockup (standalone)

**What this is:** Static HTML/CSS/JS preview of the Helix mockup hub — **illustrative only**. No database, no Express API, no sign-in.

**What you need:** A small local web server. Do not rely on opening \`index.html\` directly as a \`file://\` URL (hash routing and some behaviors work reliably over \`http://\`).

## Quick start

### Option A — Node.js (recommended)

\`\`\`bash
cd helix-mockup-standalone
npx --yes serve@14 -l 8080 .
\`\`\`

Open **http://localhost:8080/**

Or: \`npm start\` (same command via this folder's \`package.json\`).

### Option B — Python 3

\`\`\`bash
cd helix-mockup-standalone
python3 -m http.server 8080
\`\`\`

Open **http://localhost:8080/**

### Option C — VS Code

Use “Live Server” or similar on this folder.

---

**Power BI view:** The “Open live embed page” control points at the in-mockup **Power BI · Global PM** tab (\`#powerbi-pm\`) in this package — not a separate backend page.

**Live API mode:** Optional “live data” in the hub expects a running Helix backend at \`http://localhost:3000\` — disabled/offline in this package unless you run the full app separately.

**Fonts:** Inter loads from Google Fonts; internet access needed for that stylesheet.

**Regenerate this folder:** From the Helix repo root run \`npm run package:mockup\`.
`;

const miniPackageJson = {
  name: "helix-mockup-standalone",
  private: true,
  description: "Static Helix UI mockup hub — run npm start, then open http://localhost:8080/",
  scripts: {
    start: "npx --yes serve@14 -l 8080 .",
  },
};

async function main() {
  await fs.access(srcDir);
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(outDir), { recursive: true });
  await fs.cp(srcDir, outDir, {
    recursive: true,
    filter: (s) => shouldCopy(s),
  });

  const indexPath = path.join(outDir, "index.html");
  let html = await fs.readFile(indexPath, "utf8");
  html = html.replace(/href="\.\.\/powerbi-pm\.html"/g, 'href="index.html#powerbi-pm"');
  await fs.writeFile(indexPath, html, "utf8");

  await fs.writeFile(path.join(outDir, "README.md"), readme, "utf8");
  await fs.writeFile(path.join(outDir, "package.json"), JSON.stringify(miniPackageJson, null, 2) + "\n", "utf8");

  try {
    execSync(`rm -f "${zipPath}" && cd "${path.dirname(outDir)}" && zip -rq helix-mockup-standalone.zip helix-mockup-standalone`, {
      stdio: "inherit",
    });
    console.log(`ZIP: ${zipPath}`);
  } catch (e) {
    console.warn("Could not create zip (install zip CLI or create archive manually):", e.message);
  }

  console.log(`Standalone mockup: ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
