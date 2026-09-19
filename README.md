# @encore/demo-auth

The gate we put in front of client demos. Sessions, roles, scoped access, a
users console and an auth log, owned once and versioned, so the next engagement
starts from a dependency rather than from a copy of the last one.

It is deliberately small. It does not own your app's pages, your prototype, or
your database. It owns the door.

## What it gives you

- **Stateless sessions.** HMAC-signed cookie, no session store, verifiable in
  the proxy runtime and in Server Components alike.
- **Roles as data.** A role-to-permission map from your config, read by the gate
  and the UI from the same place, so they cannot disagree.
- **Scoped access.** One sign-in opens one slice: a territory, a region, an
  account. The gate compares the key in the URL against the key in the signed
  cookie, so a narrow role cannot reach another slice by typing its filename.
  Apps that show everyone the same thing leave the scope list empty.
- **A users console.** Add somebody, reset a password, switch an account off,
  change a role. Administrators only, checked in the gate and again inside every
  server action, because a button the page did not render is not a control.
- **An auth log.** Every sign-in attempt and every change to a credential, with
  who, when and from where. Never a password and never a hash.

## Wiring it up

One dependency, one config file, and a handful of one-line files.

    pnpm add @encore/demo-auth

`next.config.ts` needs to transpile it, because the package ships TypeScript
source so your Next build owns the `"use client"` and `"use server"` boundaries:

```ts
const nextConfig = { transpilePackages: ["@encore/demo-auth"] };
```

`src/auth.ts`, the only place the config is named:

```ts
import { createAuth } from "@encore/demo-auth";
import config from "../app.config.json";
export const auth = createAuth(config);
```

Then re-export what you need. Each of these is a file of one or two lines:

```ts
// src/proxy.ts
import "@/auth";
export { proxy as default } from "@encore/demo-auth/proxy";

// Written out, not re-exported: Next parses this object at compile time and
// will not follow it into a package.
export const config = {
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)"],
};

// src/app/api/auth/login/route.ts
import "@/auth";
export { POST } from "@encore/demo-auth/routes/login";
export const runtime = "nodejs";

// src/app/login/page.tsx
import "@/auth";
export { default } from "@encore/demo-auth/pages/login";
```

**Inline the config, so import order cannot bite you.** In `next.config.ts`:

```ts
import config from "./app.config.json";
const nextConfig = {
  transpilePackages: ["@encore/demo-auth"],
  env: { DEMO_AUTH_CONFIG: JSON.stringify(config) },
};
```

The config is then present in every bundle and every runtime, edge included.

This matters because a server action defined inside this package compiles into
its own server bundle. Your app imports `@/auth` from its pages, but an action
invoked on an instance where no page module has initialised never sees that
import. The singleton is unset, and the failure only appears on a cold instance,
which means it hides during testing and surfaces in front of somebody.

`createAuth()` still works and still wins where it runs. The env var is the
floor under it.

## The config

See `app.config.example.json`. The fields that matter:

| Field | What it does |
|---|---|
| `tablePrefix` | Your tables are this plus `_users` and `_auth_log`. Validated as an identifier at import, because a table name cannot be a bound parameter |
| `cookieName` | Name it per app, so two demos open in one browser do not fight |
| `roles` | Role to permission list. The package acts on `app.access`, `scope.all` and `users.manage`; add your own and read them with `can()` |
| `scopes` | `label` is what a slice is called in the UI, `assetPath` is where the generated files live, `list` is the slices. Empty list means the app is not scoped |
| `seedAdmins` | Who gets a login when you seed. Fill these in; the placeholders are skipped |

## The database

    DATABASE_URL=... node node_modules/@encore/demo-auth/src/seed.mjs ./app.config.json

Creates the tables and the first administrators, printing each generated
password once. Safe to re-run: existing people are kept, not reset.

**One client, one database instance.** Not one instance with prefixed tables per
client. Different clients carry different retention, residency and disclosure
obligations, and an instance holding two of them answers to both. The prefix is
there so an app can sit beside its own other tables, not so two engagements can
share.

## Scoped assets

When `scopes.list` is non-empty the gate expects one static file per scope at
`<assetPath>/<key>.html`, plus `<assetPath>/all.html` for the wide roles.
Generating them is the app's job, because the transform depends on what the
asset is. The rule worth keeping: **build the narrow file so the thing it must
not reach is absent from the markup**, not hidden with CSS. Hidden is a suggestion.

## Passwords

The minimum length is `PASSWORD_MIN_LENGTH`, exported so the form and the route
read the same number. It is checked in the form, where the answer can be shown,
and again in the route, which is where it is enforced.

It is deliberately not a `minLength` attribute on the input. The browser blocks
a short password with a native bubble and no message on the page, so somebody
changes their password, is told nothing, and discovers days later that the old
one still works. A rule nobody can see is not a rule, it is a trap.

## The audit log

Append only, and enforced in the database rather than by the application. An
application that merely is not writing is not the same thing as a log that
cannot be rewritten.

- **Update, delete and truncate raise.** A trigger refuses them, which stops an
  application bug and an administrator's slip.
- **Every row hashes the row before it.** Removing or editing one breaks every
  hash after it. An advisory lock serialises the read of the previous hash, so
  two inserts racing cannot fork the chain.
- **`verifyChain()` walks it** and says whether it is intact, where it broke,
  and how many rows predate the chain and so cannot be verified either way. The
  admin screen shows that line.

The trigger is not a claim about somebody with the database itself. Against them
the chain is the control: it cannot prevent tampering, it makes tampering
visible, which is what an audit log has to do to be worth having.

**Derived counts do not belong on operational screens.** An earlier version put
"3 failed tries today" next to a person's name on the roster. A number like that
invites a judgment in passing, next to the buttons that switch accounts off,
with none of the context that would justify it. The events are in the log, where
they carry their timestamps and their source addresses and can be read properly.

## Password reset by email

Off by default. Turn it on with `"passwordReset": { "enabled": true }` and two
environment variables, `SENDGRID_API_KEY` and `EMAIL_FROM`, plus the two routes
and two pages:

    src/app/api/auth/forgot/route.ts   export { POST } from "@encore/demo-auth/routes/forgot";
    src/app/api/auth/reset/route.ts    export { POST } from "@encore/demo-auth/routes/reset";
    src/app/forgot/page.tsx            export { default } from "@encore/demo-auth/pages/forgot";
    src/app/reset/page.tsx             export { default } from "@encore/demo-auth/pages/reset";

Both pages must be reachable without a session, so add `forgot` and `reset` to
the proxy matcher's exclusion list alongside `login`.

**Leave it off unless mail actually arrives.** A reset flow whose mail lands in
spam is worse than not having one: people wait for a message instead of asking
somebody. That means a sending domain with SPF and DKIM set up, not a sandbox.

What it does, and why each piece is there:

- The token is 256 bits of randomness, **stored as a SHA-256 hash**. The table
  would otherwise be a list of live keys to every account.
- One hour, single use, and using it kills every other outstanding link for that
  person. So does changing the password by any other route.
- The answer to the forgot form **never varies**: same words whether the address
  exists, the account is switched off, or the rate limit bit. Three requests an
  hour per account, and the fourth gets the same reply as the first.
- Expired, already used, and never existed give **one message**. Telling them
  apart tells somebody holding a stolen link which kind of stolen it is.
- The link comes back in the response **only when mail is unconfigured, and
  never in production**. That is why delivery reports a status rather than a
  boolean: a configured send that fails at runtime must not hand a live token to
  whoever submitted an unauthenticated form.
- Nothing logs the token or the link, on any path.

## Versioning

Tagged releases. Pin to a tag and move deliberately:

    "@encore/demo-auth": "github:bifn/encore-demo-auth#v0.1.0"

A fix here should reach every demo by a version bump, which is the entire reason
this is a package and not a folder somebody copied.
