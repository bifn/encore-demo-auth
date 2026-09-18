/* Credential check. Server-only; bcryptjs is pure JS so it runs in the Node
 * route-handler runtime. Only the login route calls this. */
import bcrypt from "bcryptjs";
import { getLoginAuth, touchLastSeen } from "./db/users.ts";
import type { SessionPayload } from "./tokens.ts";

/* The caller gets one answer to show the person and a different, more specific
 * one to write down. The screen must not distinguish an unknown address from a
 * wrong password, or the form becomes a way to enumerate the roster; the log
 * has to, or it cannot tell a typo from somebody guessing. */
export type AuthOutcome =
  | { ok: true; session: Omit<SessionPayload, "exp"> }
  | { ok: false; reason: "unknown_user" | "bad_password" };

export async function authenticate(username: string, password: string): Promise<AuthOutcome> {
  const found = await getLoginAuth(username ?? "");
  if (!found) {
    // Hash anyway so a missing username and a wrong password take the same time;
    // otherwise the response time answers "is this person a user?".
    await bcrypt.compare(password ?? "", "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin");
    return { ok: false, reason: "unknown_user" };
  }
  if (!(await bcrypt.compare(password ?? "", found.passwordHash))) {
    return { ok: false, reason: "bad_password" };
  }
  await touchLastSeen(found.user.id);
  const u = found.user;
  return {
    ok: true,
    session: { uid: u.id, username: u.username, name: u.name, initials: u.initials, role: u.role, scope: u.scope },
  };
}
