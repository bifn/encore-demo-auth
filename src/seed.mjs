#!/usr/bin/env node
/* Create the tables and the first administrators. Run once per database:
 *
 *   DATABASE_URL=... node node_modules/@encore/demo-auth/src/seed.mjs ./app.config.json
 *
 * Passwords are generated here and printed once, so a copy of the repository is
 * not a copy of the credentials. Re-running resets nobody: existing rows stay.
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

const configPath = process.argv[2] ?? "./app.config.json";
const config = JSON.parse(readFileSync(configPath, "utf8"));
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
if (!/^[a-z][a-z0-9_]{0,20}$/.test(config.tablePrefix)) {
  console.error(`tablePrefix ${JSON.stringify(config.tablePrefix)} is not a safe identifier.`);
  process.exit(1);
}

const sql = neon(url);
const USERS = `${config.tablePrefix}_users`;
const LOG = `${config.tablePrefix}_auth_log`;

await sql.query(`CREATE TABLE IF NOT EXISTS ${USERS} (
  id text PRIMARY KEY, username text NOT NULL, name text NOT NULL,
  initials text NOT NULL, role text NOT NULL, scope text NOT NULL DEFAULT 'all',
  password_hash text NOT NULL, active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz)`);
await sql.query(
  `CREATE UNIQUE INDEX IF NOT EXISTS ${config.tablePrefix}_users_username ON ${USERS} (lower(username))`);
await sql.query(`CREATE TABLE IF NOT EXISTS ${LOG} (
  id bigserial PRIMARY KEY, at timestamptz NOT NULL DEFAULT now(),
  event text NOT NULL, username text, actor text, ip text, user_agent text)`);
await sql.query(`CREATE INDEX IF NOT EXISTS ${config.tablePrefix}_auth_log_at ON ${LOG} (at DESC)`);
await sql.query(
  `CREATE INDEX IF NOT EXISTS ${config.tablePrefix}_auth_log_username ON ${LOG} (username, at DESC)`);

const admins = (config.seedAdmins ?? []).filter(
  (a) => a.username && !a.username.includes("___"));
if (!admins.length) {
  console.log("No administrators to seed. Fill in seedAdmins in the config and run this again.");
  process.exit(0);
}

const adminRole =
  Object.keys(config.roles).find((r) => (config.roles[r] ?? []).includes("users.manage"));
if (!adminRole) {
  console.error("No role in the config carries users.manage, so nobody could administer this.");
  process.exit(1);
}

for (const a of admins) {
  const username = a.username.trim().toLowerCase();
  const existing = await sql.query(`SELECT 1 FROM ${USERS} WHERE lower(username) = $1 LIMIT 1`, [username]);
  const rows = Array.isArray(existing) ? existing : (existing.rows ?? []);
  if (rows.length) {
    console.log(`  kept      ${username}`);
    continue;
  }
  const password = randomUUID().replace(/-/g, "").slice(0, 14);
  const initials = a.name.split(/\s+/).map((w) => w[0]).join("").toUpperCase();
  await sql.query(
    `INSERT INTO ${USERS} (id, username, name, initials, role, scope, password_hash)
     VALUES ($1, $2, $3, $4, $5, 'all', $6)`,
    [`u-${randomUUID().slice(0, 8)}`, username, a.name, initials, adminRole,
     await bcrypt.hash(password, 12)],
  );
  console.log(`  created   ${username}   ${password}`);
}

console.log("\nHand those passwords over now. They are not recoverable, only replaceable.");
