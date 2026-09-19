// Auth event log. Server-only.
//
// Why it exists: on the first app built this way, a password stopped matching
// its hash between one hour and the next, and the honest answer about what had
// touched it was that nobody knew. An account of who tried what, and which of
// those succeeded, is the difference between answering that and shrugging.
//
// Nothing here stores a password, a hash, or any part of either.
import { createHash } from "node:crypto";
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

/** Walks the hash chain and reports whether it is intact.
 *
 * Each row carries the hash of the row before it, so a deleted or altered row
 * breaks every hash after it. This cannot prevent tampering by somebody with
 * the database itself, and it is not meant to: it makes tampering visible,
 * which is what an audit log has to do to be worth having. */
export async function verifyChain(): Promise<{
  ok: boolean;
  entries: number;
  brokenAt: number | null;
  unchained: number;
}> {
  const rows = await q<{
    id: number; prev_hash: string | null; row_hash: string | null; payload: string;
  }>(
    `SELECT id, prev_hash, row_hash,
            coalesce(at::text,'') || '|' || event || '|' || coalesce(username,'') || '|' ||
            coalesce(actor,'') || '|' || coalesce(ip,'') || '|' || coalesce(user_agent,'') AS payload
       FROM ${cfg().authLogTable} ORDER BY id ASC`,
  );

  let prev: string | null = null;
  let unchained = 0;
  let expected: string;
  for (const r of rows) {
    // Rows written before the chain existed carry no hash. They are counted and
    // named rather than quietly treated as verified.
    if (r.row_hash === null) {
      unchained += 1;
      continue;
    }
    expected = createHash("sha256")
      .update(`${prev ?? ""}|${r.payload}`)
      .digest("hex");
    if (r.prev_hash !== prev || r.row_hash !== expected) {
      return { ok: false, entries: rows.length, brokenAt: r.id, unchained };
    }
    prev = r.row_hash;
  }
  return { ok: true, entries: rows.length, brokenAt: null, unchained };
}

/** Idempotent. Safe to call at seed time and after an upgrade. */
export async function ensureTables(): Promise<void> {
  const c = cfg();
  // digest() for the chain. Neon ships pgcrypto; this is a no-op after the first run.
  await q(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
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
  await q(`ALTER TABLE ${c.authLogTable} ADD COLUMN IF NOT EXISTS prev_hash text`);
  await q(`ALTER TABLE ${c.authLogTable} ADD COLUMN IF NOT EXISTS row_hash text`);

  /* Two things make this an audit log rather than a table somebody happens not
   * to be writing to.
   *
   * The chain: every row hashes the row before it, so removing or editing one
   * breaks every hash after it. An advisory lock serialises the read of the
   * previous hash, because two inserts racing would otherwise both chain from
   * the same parent and the chain would fork.
   *
   * The refusal: update, delete and truncate raise. This stops application
   * bugs and an administrator's slip, and it is not a claim about somebody with
   * the database itself. Against them the chain is the control, because it
   * makes what they did visible afterwards. */
  await q(`CREATE OR REPLACE FUNCTION ${c.tablePrefix}_auth_log_chain()
           RETURNS trigger AS $fn$
           DECLARE last_hash text;
           BEGIN
             PERFORM pg_advisory_xact_lock(hashtext('${c.authLogTable}'));
             SELECT row_hash INTO last_hash FROM ${c.authLogTable}
               WHERE row_hash IS NOT NULL ORDER BY id DESC LIMIT 1;
             NEW.prev_hash := last_hash;
             NEW.row_hash := encode(digest(
               coalesce(last_hash,'') || '|' ||
               coalesce(NEW.at::text,'') || '|' || NEW.event || '|' ||
               coalesce(NEW.username,'') || '|' || coalesce(NEW.actor,'') || '|' ||
               coalesce(NEW.ip,'') || '|' || coalesce(NEW.user_agent,''), 'sha256'), 'hex');
             RETURN NEW;
           END $fn$ LANGUAGE plpgsql`);
  await q(`CREATE OR REPLACE FUNCTION ${c.tablePrefix}_auth_log_readonly()
           RETURNS trigger AS $fn$
           BEGIN
             RAISE EXCEPTION 'the auth log is append only: % is not allowed', TG_OP;
           END $fn$ LANGUAGE plpgsql`);
  await q(`DROP TRIGGER IF EXISTS ${c.tablePrefix}_auth_log_chain_t ON ${c.authLogTable}`);
  await q(`CREATE TRIGGER ${c.tablePrefix}_auth_log_chain_t
           BEFORE INSERT ON ${c.authLogTable}
           FOR EACH ROW EXECUTE FUNCTION ${c.tablePrefix}_auth_log_chain()`);
  await q(`DROP TRIGGER IF EXISTS ${c.tablePrefix}_auth_log_readonly_t ON ${c.authLogTable}`);
  await q(`CREATE TRIGGER ${c.tablePrefix}_auth_log_readonly_t
           BEFORE UPDATE OR DELETE ON ${c.authLogTable}
           FOR EACH ROW EXECUTE FUNCTION ${c.tablePrefix}_auth_log_readonly()`);
  await q(`DROP TRIGGER IF EXISTS ${c.tablePrefix}_auth_log_notruncate_t ON ${c.authLogTable}`);
  await q(`CREATE TRIGGER ${c.tablePrefix}_auth_log_notruncate_t
           BEFORE TRUNCATE ON ${c.authLogTable}
           FOR EACH STATEMENT EXECUTE FUNCTION ${c.tablePrefix}_auth_log_readonly()`);

  for (const stmt of CREATE_SQL(c.tablePrefix)) await q(stmt);
}
