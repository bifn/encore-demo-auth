/* ----------------------------------------------------------------------------
 * The consuming app's settings, held as a module singleton.
 *
 * Why a singleton rather than threading config through every call: this package
 * is imported by route handlers, Server Components and the proxy, each of which
 * Next may bundle separately. Every one of those entry points imports the app's
 * own `auth` module, which calls createAuth() at import time, so the config is
 * set before anything reads it in each bundle. Threading it by hand would put a
 * parameter on thirty functions to solve a problem that does not exist.
 * ------------------------------------------------------------------------- */

export interface Scope {
  key: string;
  label: string;
}

export interface AppConfig {
  /** Shown on the login screen and in the page title. */
  name: string;
  org: string;
  /** One line under the sign-in heading. */
  description?: string;
  /** Sentence shown under the login card: why this door exists at all. */
  note?: string;
  /** Table names are this plus _users and _auth_log. One client, one database. */
  tablePrefix: string;
  cookieName: string;
  sessionHours: number;
  /** Role to permission list. "app.access", "scope.all" and "users.manage" are
   *  the ones this package acts on; an app may add its own and read them with can(). */
  roles: Record<string, string[]>;
  /** The slice a sign-in may open. Empty means the app is not scoped at all. */
  scopes: { label: string; assetPath: string; list: Scope[] };
  /** Self-serve password reset by email. Off unless the app has a sender that
   *  actually delivers: a reset flow whose mail lands in spam is worse than
   *  none, because people wait for it instead of asking somebody. */
  passwordReset?: { enabled: boolean };
}

let current: (AppConfig & { usersTable: string; authLogTable: string }) | null = null;

export function setConfig(config: AppConfig) {
  // A table prefix reaches a query as an identifier, and an identifier cannot be
  // a bound parameter. So it is validated here rather than trusted, and anything
  // outside this shape stops the app at import instead of at the first query.
  if (!/^[a-z][a-z0-9_]{0,20}$/.test(config.tablePrefix)) {
    throw new Error(
      `demo-auth: tablePrefix ${JSON.stringify(config.tablePrefix)} must be lower-case letters, digits and underscores, starting with a letter`,
    );
  }
  if (!config.cookieName || !/^[A-Za-z0-9_-]+$/.test(config.cookieName)) {
    throw new Error("demo-auth: cookieName must be set and URL-safe");
  }
  current = {
    ...config,
    usersTable: `${config.tablePrefix}_users`,
    authLogTable: `${config.tablePrefix}_auth_log`,
  };
  return current;
}

export function cfg() {
  if (!current) {
    throw new Error(
      "demo-auth: createAuth() has not run in this bundle. Import your app's auth module (the one that calls createAuth) from every entry point that uses this package.",
    );
  }
  return current;
}

/** True when this app scopes what a sign-in can open. */
export function isScoped(): boolean {
  return cfg().scopes.list.length > 0;
}

export function scopeLabel(key: string): string {
  const c = cfg();
  if (key === "all") return `Every ${c.scopes.label.toLowerCase()}`;
  return c.scopes.list.find((s) => s.key === key)?.label ?? key;
}
