// Neon serverless Postgres. Server-only: never import from a client component,
// it reads DATABASE_URL and would leak the connection string.
//
// One client, one database. This package never shares an instance between two
// engagements, and a table prefix is not a substitute for that: different
// clients carry different retention, residency and disclosure obligations, and
// an instance holding two of them answers to both.
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.warn("[demo-auth] DATABASE_URL is not set, so sign-in and user management will fail.");
}

export const sql = neon(process.env.DATABASE_URL ?? "");
