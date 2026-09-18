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

**Import `@/auth` from every entry point that uses the package.** Next bundles
route handlers, Server Components and the proxy separately, and the config is a
module singleton in each of those bundles. The package throws a named error
rather than misbehaving if you miss one.

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

## Versioning

Tagged releases. Pin to a tag and move deliberately:

    "@encore/demo-auth": "github:bifn/encore-demo-auth#v0.1.0"

A fix here should reach every demo by a version bump, which is the entire reason
this is a package and not a folder somebody copied.
