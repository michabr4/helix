import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { pool } from "../db.js";
import { env } from "../config.js";

const steps: Record<string, unknown> = {};

try {
  const result = await pool.query(
    "SELECT user_id, role, password_hash FROM mgm.users WHERE lower(trim(email)) = $1 LIMIT 1",
    ["admin@serviceflow.local"]
  );
  const user = result.rows[0];
  steps.userFound = !!user;

  const valid = await bcrypt.compare("ChangeMe123!", user.password_hash);
  steps.bcryptValid = valid;

  const jti = randomUUID();
  // Fixed: jti only via jwtid option, not in payload spread
  const accessToken = jwt.sign({ userId: user.user_id, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRE as jwt.SignOptions["expiresIn"],
    jwtid: jti,
  });
  steps.jwtSigned = !!accessToken;
  steps.success = true;
} catch (err) {
  steps.error = String(err);
  steps.stack = err instanceof Error ? err.stack : undefined;
}

writeFileSync(
  "/Users/michabr4/Desktop/serviceflow-sdm/backend/login_test_result.json",
  JSON.stringify(steps, null, 2)
);
await pool.end();
