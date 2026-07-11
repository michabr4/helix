/**
 * seedUserProperties.ts — dev/staging helper
 *
 * Assigns every existing property to every existing user in mgm.user_properties.
 * Run once after the initial migration to unblock development environments where
 * viewer-role users would otherwise see no data.
 *
 * Usage: npm run seed-user-properties
 * (Add to package.json scripts: "seed-user-properties": "tsx src/scripts/seedUserProperties.ts")
 *
 * DO NOT run against production — use the admin API to assign properties deliberately.
 */

import { pool } from "../db.js";

async function main() {
  const users = await pool.query("SELECT user_id, role FROM mgm.users");
  const properties = await pool.query("SELECT property_id, name FROM mgm.properties");

  if (users.rowCount === 0) {
    console.log(JSON.stringify({ level: "warn", message: "No users found — run migrations and seeds first." }));
    await pool.end();
    return;
  }
  if (properties.rowCount === 0) {
    console.log(JSON.stringify({ level: "warn", message: "No properties found — run seeds first." }));
    await pool.end();
    return;
  }

  let assigned = 0;
  for (const user of users.rows) {
    for (const prop of properties.rows) {
      const result = await pool.query(
        `INSERT INTO mgm.user_properties (user_id, property_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [user.user_id, prop.property_id]
      );
      if ((result.rowCount ?? 0) > 0) assigned++;
    }
  }

  console.log(JSON.stringify({
    level: "info",
    message: "seed_user_properties_done",
    users: users.rowCount,
    properties: properties.rowCount,
    rows_inserted: assigned
  }));
  await pool.end();
}

main().catch((err) => {
  console.error(JSON.stringify({ level: "error", message: "seed_failed", error: String(err) }));
  process.exit(1);
});
