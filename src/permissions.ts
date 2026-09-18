/* Role to capability. Pure data, no Node or Next imports, so the proxy (edge
 * runtime), Server Components and the client can all read it.
 *
 * The rule this encodes: how much you can see and whether you can hand it out
 * are two different axes. An executive reads every scope and still cannot
 * create a login. Conflate them and every read-wide role becomes an admin role.
 */
import { cfg, isScoped } from "./config";

export type Permission = "app.access" | "scope.all" | "users.manage" | (string & {});

export function roles(): string[] {
  return Object.keys(cfg().roles);
}

export function can(role: string | undefined, perm: Permission): boolean {
  if (!role) return false;
  // With nothing to withhold, scope.all is not a distinction worth enforcing.
  if (perm === "scope.all" && !isScoped()) return true;
  return (cfg().roles[role] ?? []).includes(perm);
}

/** The asset key this session may open: its own scope, or "all". */
export function scopeKeyFor(session: { role: string; scope: string }): string {
  return can(session.role, "scope.all") ? "all" : session.scope;
}
