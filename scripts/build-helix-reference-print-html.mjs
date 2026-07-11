/**
 * Generates docs/HELIX_MOCKUP_REFERENCE_PRINT.html from HELIX_MOCKUP_REFERENCE.md
 * for reliable PDF export: open the HTML in a browser → Print → Save as PDF.
 */
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { marked } from "marked";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const mdPath = join(root, "docs", "HELIX_MOCKUP_REFERENCE.md");
const outPath = join(root, "docs", "HELIX_MOCKUP_REFERENCE_PRINT.html");

const md = readFileSync(mdPath, "utf8");
const body = marked.parse(md, { gfm: true });

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Helix UI Mockup Hub — Reference &amp; Playbook</title>
  <style>
    :root {
      --text: #0f172a;
      --muted: #475569;
      --border: #cbd5e1;
      --bg: #fff;
    }
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.45;
      color: var(--text);
      background: var(--bg);
      max-width: 900px;
      margin: 0 auto;
      padding: 24px 20px 48px;
    }
    h1 { font-size: 1.75rem; margin: 0 0 0.5rem; line-height: 1.2; }
    h2 { font-size: 1.25rem; margin: 1.75rem 0 0.75rem; page-break-after: avoid; border-bottom: 1px solid var(--border); padding-bottom: 6px; }
    h3 { font-size: 1.05rem; margin: 1.25rem 0 0.5rem; page-break-after: avoid; }
    p { margin: 0.5rem 0; }
    ul, ol { margin: 0.5rem 0; padding-left: 1.35rem; }
    li { margin: 0.25rem 0; }
    strong { font-weight: 600; }
    code {
      font-family: ui-monospace, "Cascadia Code", monospace;
      font-size: 0.88em;
      background: #f1f5f9;
      padding: 1px 5px;
      border-radius: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10pt;
      margin: 0.75rem 0 1rem;
      page-break-inside: auto;
    }
    tr { page-break-inside: avoid; page-break-after: auto; }
    th, td {
      border: 1px solid var(--border);
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }
    th { background: #f8fafc; font-weight: 600; }
    hr { border: 0; border-top: 1px solid var(--border); margin: 1.5rem 0; }
    blockquote {
      margin: 0.75rem 0;
      padding: 0.5rem 1rem;
      border-left: 4px solid #94a3b8;
      background: #f8fafc;
      color: var(--muted);
    }
    .print-hint {
      background: #eff6ff;
      border: 1px solid #93c5fd;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 28px;
      font-size: 10.5pt;
    }
    @media print {
      body { padding: 0; max-width: none; font-size: 10pt; }
      .print-hint { border: 1px dashed #64748b; background: #fff; }
      a[href^="http"]::after { content: " (" attr(href) ")"; font-size: 8pt; color: #64748b; }
    }
  </style>
</head>
<body>
  <div class="print-hint" role="note">
    <strong>Export to PDF:</strong> Use <kbd>Cmd/Ctrl + P</kbd> → Destination <strong>Save as PDF</strong> → enable <strong>Background graphics</strong> if you want shaded table headers.
  </div>
  <main>${body}</main>
</body>
</html>
`;

writeFileSync(outPath, html, "utf8");
console.log("Wrote", outPath);
