/**
 * Full login diagnostic — run with:
 *   npx tsx src/scripts/diagnose.ts
 * Results written to: backend/diagnose_result.json
 */
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { Pool } from "pg";
import "dotenv/config";

const out: Record<string, unknown> = {};

// 1. Env vars
out.env = {
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD ? "SET" : "MISSING",
  JWT_SECRET: process.env.JWT_SECRET ? `SET (${process.env.JWT_SECRET.length} chars)` : "MISSING",
  JWT_EXPIRE: process.env.JWT_EXPIRE,
};

// 2. DB connection
const pool = new Pool({
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? "helix_sdm",
  user: process.env.DB_USER ?? "serviceflow_admin",
  password: process.env.DB_PASSWORD ?? "change_me",
});

try {
  await pool.query("SELECT 1");
  out.db_connect = "OK";
} catch (e) {
  out.db_connect = String(e);
}

// 3. User lookup
try {
  const r = await pool.query(
    "SELECT user_id, role, password_hash FROM mgm.users WHERE lower(trim(email)) = $1 LIMIT 1",
    ["admin@serviceflow.local"]
  );
  const user = r.rows[0];
  out.user_found = !!user;
  out.user_id = user?.user_id;
  out.user_role = user?.role;
  out.password_hash_prefix = user?.password_hash?.slice(0, 10);
  out.password_hash_length = user?.password_hash?.length;

  // 4. bcrypt
  if (user?.password_hash) {
    out.bcrypt_match = await bcrypt.compare("ChangeMe123!", user.password_hash);
  }

  // 5. JWT sign
  if (out.bcrypt_match) {
    try {
      const jti = randomUUID();
      const token = jwt.sign(
        { userId: user.user_id, role: user.role },
        process.env.JWT_SECRET!,
        { expiresIn: (process.env.JWT_EXPIRE ?? "15m") as jwt.SignOptions["expiresIn"], jwtid: jti }
      );
      out.jwt_signed = !!token;
      out.jwt_preview = token.slice(0, 30) + "...";

      // 6. JWT verify round-trip
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as Record<string, unknown>;
      out.jwt_verify = "OK";
      out.jwt_decoded_jti = decoded.jti;
      out.jwt_decoded_userId = decoded.userId;
    } catch (e) {
      out.jwt_error = String(e);
    }
  }
} catch (e) {
  out.db_query_error = String(e);
}

await pool.end();

out.overall = !out.db_query_error && !out.jwt_error && out.bcrypt_match && out.jwt_verify === "OK"
  ? "ALL_PASS — login should work"
  : "FAILED — see errors above";

const dest = new URL("../../diagnose_result.json", import.meta.url).pathname;
writeFileSync(dest, JSON.stringify(out, null, 2));
console.log("Written to", dest);
