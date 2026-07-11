import { pathToFileURL } from "node:url";
import bcrypt from "bcryptjs";
import { pool } from "../db.js";

/** Must match README / Operations defaults. Hashed at migrate time so DB always matches bcryptjs.verify. */
const DEV_PASSWORD = "ChangeMe123!";
const DEV_EMAILS = [
  "admin@serviceflow.local",
  "sdm@serviceflow.local",
  "engineer@serviceflow.local"
] as const;

export async function ensureDevUserPasswordHashes(): Promise<number> {
  const hash = await bcrypt.hash(DEV_PASSWORD, 12);
  const r = await pool.query(`UPDATE mgm.users SET password_hash = $1 WHERE email = ANY($2::text[])`, [
    hash,
    [...DEV_EMAILS]
  ]);
  return r.rowCount ?? 0;
}

function isCliInvocation(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return false;
  }
}

async function cliMain() {
  const n = await ensureDevUserPasswordHashes();
  console.log(
    JSON.stringify({
      level: n > 0 ? "info" : "warn",
      message: n > 0 ? "dev_password_hashes_updated" : "dev_password_hashes_no_matching_users",
      rows: n,
      hint:
        n === 0
          ? "No seed users found — run npm run migrate (or insert mgm.users rows) first."
          : undefined
    })
  );
  await pool.end();
}

if (isCliInvocation()) {
  cliMain().catch((error) => {
    console.error(JSON.stringify({ level: "error", message: "ensure_dev_passwords_failed", error: String(error) }));
    process.exit(1);
  });
}
