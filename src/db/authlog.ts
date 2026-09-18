// Auth event log. Server-only.
//
// Why it exists: on the first app built this way, a password stopped matching
// its hash between one hour and the next, and the honest answer about what had
// touched it was that nobody knew. An account of who tried what, and which of
// those succeeded, is the difference between answering that and shrugging.
//
// Nothing here stores a password, a hash, or any part of either.
import { sql } from "./client";
import { cfg } from "../config";
import { CREATE_SQL } from "./resets";

export type AuthEvent =
  | "login.ok" | "login.bad_password" | "login.unknown_user" | "login.inactive"
  | "logout" | "password.changed" | "password.reset_by_admin"
  | "password.reset_requested" | "password.reset_throttled"
  | "password.reset_used" | "password.reset_rejected"
  | "user.created" | "user.activated" | "user.deactivated" | "user.edited";

export interface AuthLogRow {
  id: number; at: string; event: AuthEvent;
  username: string | null; actor: string | null;
  ip: string | null; userAgent: string | null;
}

async function q<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const r = (await sql.query(text, params)) as unknown;
  return (Array.isArray(r) ? r : ((r as { rows: T[] }).rows ?? [])) as T[];
}

/** Never throws. A log that can break a sign-in is worse than no log. */
export async function record(e: {
  event: AuthEvent;
  username?: string | null;
  /** Who performed it, when that differs from the subject. */
  actor?: string | null;
  headers?: Headers;
}): Promise<void> {
  try {
    const ip =
      e.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      e.headers?.get("x-real-ip") ?? null;
    // Truncated: enough to tell a browser from a script, not a fingerprint.
    const ua = e.headers?.get("user-agent")?.slice(0, 180) ?? null;
    await q(
      `INSERT INTO ${cfg().authLogTable} (event, username, actor, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [e.event, e.username?.toLowerCase() ?? null, e.actor ?? null, ip, ua],
    );
  } catch (err) {
    console.error("[demo-auth] could not record %s: %s", e.event, err);
  }
}

export async function recent(limit = 100): Promise<AuthLogRow[]> {
  const rows = await q<{
    id: number; at: string; event: string; username: string | null;
    actor: string | null; ip: string | null; user_agent: string | null;
  }>(
    `SELECT id, at, event, username, actor, ip, user_agent
       FROM ${cfg().authLogTable} ORDER BY at DESC LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({
    id: r.id, at: r.at, event: r.event as AuthEvent, username: r.username,
    actor: r.actor, ip: r.ip, userAgent: r.user_agent,
  }));
}

/** Failed attempts per address since a moment, for the roster's warning. */
export async function failuresSince(hours = 24): Promise<Record<string, number>> {
  const rows = await q<{ username: string; n: number }>(
    `SELECT username, count(*)::int AS n
       FROM ${cfg().authLogTable}
      WHERE event LIKE 'login.%' AND event <> 'login.ok'
        AND at > now() - make_interval(hours => $1)
        AND username IS NOT NULL
      GROUP BY username`,
    [hours],
  );
  return Object.fromEntries(rows.map((r) => [r.username, r.n]));
}

/** Idempotent. Safe to call at seed time and after an upgrade. */
export async function ensureTables(): Promise<void> {
  const c = cfg();
  await q(`CREATE TABLE IF NOT EXISTS ${c.usersTable} (
    id text PRIMARY KEY, username text NOT NULL, name text NOT NULL,
    initials text NOT NULL, role text NOT NULL, scope text NOT NULL DEFAULT 'all',
    password_hash text NOT NULL, active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz)`);
  await q(`CREATE UNIQUE INDEX IF NOT EXISTS ${c.tablePrefix}_users_username
           ON ${c.usersTable} (lower(username))`);
  await q(`CREATE TABLE IF NOT EXISTS ${c.authLogTable} (
    id bigserial PRIMARY KEY, at timestamptz NOT NULL DEFAULT now(),
    event text NOT NULL, username text, actor text, ip text, user_agent text)`);
  await q(`CREATE INDEX IF NOT EXISTS ${c.tablePrefix}_auth_log_at
           ON ${c.authLogTable} (at DESC)`);
  await q(`CREATE INDEX IF NOT EXISTS ${c.tablePrefix}_auth_log_username
           ON ${c.authLogTable} (username, at DESC)`);
  for (const stmt of CREATE_SQL(c.tablePrefix)) await q(stmt);
}
