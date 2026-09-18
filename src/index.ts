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
export { setConfig as createAuth, cfg, isScoped, scopeLabel } from "./config";
export type { AppConfig, Scope } from "./config";

export { can, roles, scopeKeyFor } from "./permissions";
export type { Permission } from "./permissions";

export { getSession } from "./session";
export { createToken, verifyToken, sessionCookie, sessionTtlSeconds } from "./tokens";
export type { SessionPayload } from "./tokens";

export { authenticate } from "./accounts";
export type { AuthOutcome } from "./accounts";

export { record, recent, failuresSince, ensureTables } from "./db/authlog";
export type { AuthEvent, AuthLogRow } from "./db/authlog";

export {
  listUsers, getUserById, createUser, setActive, setPassword, updateUser,
} from "./db/users";
export type { DbUser } from "./db/users";

export { proxy, proxyMatcher } from "./proxy";
