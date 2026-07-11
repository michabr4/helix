import bcrypt from "bcryptjs";
import { writeFileSync } from "node:fs";
import { pool } from "../db.js";

const r = await pool.query("SELECT email, password_hash FROM mgm.users WHERE email = 'admin@serviceflow.local'");
const user = r.rows[0];
const ok = await bcrypt.compare("ChangeMe123!", user.password_hash);
const result = { hashPrefix: user?.password_hash?.slice(0, 10), bcryptMatch: ok };
writeFileSync("/Users/michabr4/Desktop/serviceflow-sdm/backend/verify_result.json", JSON.stringify(result, null, 2));
await pool.end();
