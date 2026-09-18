/* ----------------------------------------------------------------------------
 * @encore/demo-auth
 *
 * The gate we put in front of client demos. One call wires it up:
 *
 *   // src/auth.ts in the consuming app
 *   import { createAuth } from "@encore/demo-auth";
 *   import config from "../app.config.json";
 *   export const auth = createAuth(config);
 *
 * Every entry point that uses this package imports that module, which is what
 * puts the config in each of Next's separate bundles. See the README.
 * ------------------------------------------------------------------------- */
export { setConfig as createAuth, cfg, isScoped, scopeLabel } from "./config.ts";
export type { AppConfig, Scope } from "./config.ts";

export { can, roles, scopeKeyFor } from "./permissions.ts";
export type { Permission } from "./permissions.ts";

export { getSession } from "./session.ts";
export { createToken, verifyToken, sessionCookie, sessionTtlSeconds } from "./tokens.ts";
export type { SessionPayload } from "./tokens.ts";

export { authenticate } from "./accounts.ts";
export type { AuthOutcome } from "./accounts.ts";

export { record, recent, failuresSince, ensureTables } from "./db/authlog.ts";
export type { AuthEvent, AuthLogRow } from "./db/authlog.ts";

export {
  listUsers, getUserById, createUser, setActive, setPassword, updateUser,
} from "./db/users.ts";
export type { DbUser } from "./db/users.ts";

export { proxy, proxyMatcher } from "./proxy.ts";
