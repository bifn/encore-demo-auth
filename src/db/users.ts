// Users and logins. Server-only.
//
// Queries go through sql.query with positional parameters because the table name
// comes from config and an identifier cannot be bound. The name is validated in
// config.ts at import; every value here is still a parameter, never interpolated.
import { sql } from "./client";
import { cfg } from "../config";

export interface DbUser {
  id: string;
  username: string;
  name: string;
  initials: string;
  role: string;
  scope: string;
  active: boolean;
  createdAt: string;
  lastSeenAt: string | null;
}

type Row = {
  id: string; username: string; name: string; initials: string; role: string;
  scope: string; active: boolean; created_at: string; last_seen_at: string | null;
};

/** The driver returns either an array or a result object depending on the call. */
async function q<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const r = (await sql.query(text, params)) as unknown;
  return (Array.isArray(r) ? r : ((r as { rows: T[] }).rows ?? [])) as T[];
}

function map(r: Row): DbUser {
  return {
    id: r.id, username: r.username, name: r.name, initials: r.initials,
    role: r.role, scope: r.scope, active: r.active,
    createdAt: r.created_at, lastSeenAt: r.last_seen_at,
  };
}

export async function getLoginAuth(
  username: string,
): Promise<{ user: DbUser; passwordHash: string } | null> {
  const rows = await q<Row & { password_hash: string }>(
    `SELECT * FROM ${cfg().usersTable} WHERE lower(username) = $1 AND active = true`,
    [username.trim().toLowerCase()],
  );
  return rows[0] ? { user: map(rows[0]), passwordHash: rows[0].password_hash } : null;
}

export async function listUsers(): Promise<DbUser[]> {
  const rows = await q<Row>(
    `SELECT * FROM ${cfg().usersTable} ORDER BY active DESC, name ASC`);
  return rows.map(map);
}

export async function getUserById(id: string): Promise<DbUser | null> {
  const rows = await q<Row>(`SELECT * FROM ${cfg().usersTable} WHERE id = $1`, [id]);
  return rows[0] ? map(rows[0]) : null;
}

export async function usernameExists(username: string): Promise<boolean> {
  const rows = await q(
    `SELECT 1 FROM ${cfg().usersTable} WHERE lower(username) = $1 LIMIT 1`,
    [username.trim().toLowerCase()],
  );
  return rows.length > 0;
}

export async function createUser(u: {
  id: string; username: string; name: string; initials: string;
  role: string; scope: string; passwordHash: string;
}): Promise<void> {
  await q(
    `INSERT INTO ${cfg().usersTable}
       (id, username, name, initials, role, scope, password_hash, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
    [u.id, u.username.trim().toLowerCase(), u.name, u.initials, u.role, u.scope, u.passwordHash],
  );
}

export async function setActive(id: string, active: boolean): Promise<void> {
  await q(`UPDATE ${cfg().usersTable} SET active = $2 WHERE id = $1`, [id, active]);
}

export async function setPassword(id: string, passwordHash: string): Promise<void> {
  await q(`UPDATE ${cfg().usersTable} SET password_hash = $2 WHERE id = $1`, [id, passwordHash]);
}

export async function updateUser(
  id: string,
  u: { name: string; role: string; scope: string; initials: string },
): Promise<void> {
  await q(
    `UPDATE ${cfg().usersTable}
        SET name = $2, role = $3, scope = $4, initials = $5 WHERE id = $1`,
    [id, u.name, u.role, u.scope, u.initials],
  );
}

/** Stamped on each sign-in, so the roster shows who has actually been in. */
export async function touchLastSeen(id: string): Promise<void> {
  await q(`UPDATE ${cfg().usersTable} SET last_seen_at = now() WHERE id = $1`, [id]);
}
