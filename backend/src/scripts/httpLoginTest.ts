/**
 * Raw HTTP login test — bypasses fetch/proxy entirely.
 * Run with backend running: npx tsx src/scripts/httpLoginTest.ts
 */
import http from "node:http";
import { writeFileSync } from "node:fs";

const body = JSON.stringify({ email: "admin@serviceflow.local", password: "ChangeMe123!" });

const result: Record<string, unknown> = {};

const req = http.request({
  hostname: "localhost",
  port: 3000,
  path: "/api/v1/auth/login",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  },
}, (res) => {
  result.statusCode = res.statusCode;
  result.headers = res.headers;
  let raw = "";
  res.on("data", (chunk) => { raw += chunk; });
  res.on("end", () => {
    result.rawBody = raw;
    try { result.parsedBody = JSON.parse(raw); } catch { result.parseError = "not JSON"; }
    const dest = new URL("../../http_login_result.json", import.meta.url).pathname;
    writeFileSync(dest, JSON.stringify(result, null, 2));
    console.log("Written to", dest);
  });
});

req.on("error", (e) => {
  result.connectionError = String(e);
  const dest = new URL("../../http_login_result.json", import.meta.url).pathname;
  writeFileSync(dest, JSON.stringify(result, null, 2));
  console.log("Written to", dest);
});

req.write(body);
req.end();
