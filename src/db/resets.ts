// Password reset tokens. Server-only.
//
// The token is stored as a SHA-256 hash, never in the clear: the table would
// otherwise be a list of live keys to every account, readable by anyone who can
// read the database. The token itself carries 256 bits of randomness, so a fast
// hash is the right one here; bcrypt protects guessable secrets, and this is not
// one.
import { createHash, randomBytes } from "node:crypto";
import { sql } from "./client";
import { cfg } from "../config";

export const TOKEN_TTL_MINUTES = 60;

async function q<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const r = (await sql.query(text, params)) as unknown;
  return (Array.isArray(r) ? r : ((r as { rows: T[] }).rows ?? [])) as T[];
}

function table(): string {
  return `${cfg().tablePrefix}_password_resets`;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Returns the clear token, which exists in memory and in one email and nowhere else. */
export async function issueToken(userId: string, ip: string | null): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await q(
    `INSERT INTO ${table()} (user_id, token_hash, expires_at, requested_ip)
     VALUES ($1, $2, now() + make_interval(mins => $3), $4)`,
    [userId, hashToken(token), TOKEN_TTL_MINUTES, ip],
  );
  return token;
}

export interface ResetRow {
  id: number;
  userId: string;
}

/** An unused, unexpired token, or null. Says nothing about why it failed. */
export async function findUsable(token: string): Promise<ResetRow | null> {
  const rows = await q<{ id: number; user_id: string }>(
    `SELECT id, user_id FROM ${table()}
      WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
      LIMIT 1`,
    [hashToken(token)],
  );
  return rows[0] ? { id: rows[0].id, userId: rows[0].user_id } : null;
}

/** Marks this one used and kills every other outstanding token for that person. */
export async function consume(id: number, userId: string): Promise<void> {
  await q(`UPDATE ${table()} SET used_at = now() WHERE id = $1`, [id]);
  await q(
    `UPDATE ${table()} SET used_at = now() WHERE user_id = $1 AND used_at IS NULL`,
    [userId],
  );
}

/** Outstanding requests for one address in the last hour, for rate limiting. */
export async function recentRequests(userId: string): Promise<number> {
  const rows = await q<{ n: number }>(
    `SELECT count(*)::int AS n FROM ${table()}
      WHERE user_id = $1 AND created_at > now() - make_interval(mins => 60)`,
    [userId],
  );
  return rows[0]?.n ?? 0;
}

/** A password change by any route invalidates every outstanding link. */
export async function invalidateAll(userId: string): Promise<void> {
  await q(
    `UPDATE ${table()} SET used_at = now() WHERE user_id = $1 AND used_at IS NULL`,
    [userId],
  );
}

export const CREATE_SQL = (prefix: string) => [
  `CREATE TABLE IF NOT EXISTS ${prefix}_password_resets (
     id bigserial PRIMARY KEY,
     user_id text NOT NULL,
     token_hash text NOT NULL,
     expires_at timestamptz NOT NULL,
     used_at timestamptz,
     requested_ip text,
     created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS ${prefix}_password_resets_hash
     ON ${prefix}_password_resets (token_hash)`,
  `CREATE INDEX IF NOT EXISTS ${prefix}_password_resets_user
     ON ${prefix}_password_resets (user_id, created_at DESC)`,
];
