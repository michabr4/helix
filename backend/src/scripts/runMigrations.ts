import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pool } from "../db.js";
import { ensureDevUserPasswordHashes } from "./ensureDevPasswords.js";

async function runSql(filePath: string) {
  const sql = await readFile(filePath, "utf8");
  await pool.query(sql);
}

async function main() {
  // Run all migrations in infra/migrations/ in alphabetical order (safe to re-run — all use IF NOT EXISTS)
  const migrationsDir = resolve(process.cwd(), "..", "infra", "migrations");
  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const filePath = resolve(migrationsDir, file);
    console.log(JSON.stringify({ level: "info", message: "running_migration", file }));
    await runSql(filePath);
  }

  // Run seeds
  const seedsDir = resolve(process.cwd(), "..", "infra", "seeds");
  const seeds = (await readdir(seedsDir)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of seeds) {
    const filePath = resolve(seedsDir, file);
    console.log(JSON.stringify({ level: "info", message: "running_seed", file }));
    await runSql(filePath);
  }

  const pwdRows = await ensureDevUserPasswordHashes();
  console.log(
    JSON.stringify({
      level: "info",
      message: "migrations_completed",
      dev_password_hash_rows_updated: pwdRows
    })
  );
  await pool.end();
}

main().catch((error) => {
  console.error(JSON.stringify({ level: "error", message: "migrations_failed", error: String(error) }));
  process.exit(1);
});
