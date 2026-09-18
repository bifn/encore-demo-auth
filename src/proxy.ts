import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sessionCookie, verifyToken } from "./tokens";
import { can, scopeKeyFor } from "./permissions";
import { cfg, isScoped } from "./config";

/* ----------------------------------------------------------------------------
 * The gate. Everything is closed except the login page and the auth API.
 *
 * Three jobs, and the second is the one worth having:
 *
 *   1. No session, no entry.
 *   2. A session opens exactly one slice. Scoped assets are static files, one
 *      per scope, generated so that a narrow scope's file has the switcher
 *      removed from the markup rather than hidden. The key in the URL has to
 *      match the key in the signed cookie, so typing another scope's filename
 *      is a redirect, not a peek.
 *   3. Managing users needs users.manage, checked here and again in the action.
 *
 * Static assets under the scoped path are gated too, deliberately. A prototype
 * readable by anybody who knew its path would make the login theatre.
 * ------------------------------------------------------------------------- */
export async function proxy(req: NextRequest) {
  const session = await verifyToken(req.cookies.get(sessionCookie())?.value);
  const path = req.nextUrl.pathname;

  if (!session) {
    const url = req.nextUrl.clone();
    const intended = path + req.nextUrl.search;
    url.pathname = "/login";
    url.search = intended && intended !== "/" ? `?next=${encodeURIComponent(intended)}` : "";
    return NextResponse.redirect(url);
  }

  if (path === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const assetPath = cfg().scopes.assetPath;
  if (isScoped() && assetPath && path.startsWith(`${assetPath}/`)) {
    const allowed = `${assetPath}/${scopeKeyFor(session)}.html`;
    if (path !== allowed) {
      const url = req.nextUrl.clone();
      url.pathname = allowed;
      url.search = "";
      return NextResponse.redirect(url);
    }
    // A client's slice is not something to cache at a shared edge.
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  }

  if (path === "/users" || path.startsWith("/users/")) {
    if (!can(session.role, "users.manage")) {
      const url = req.nextUrl.clone();
      url.pathname = "/app";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

/** Everything except the login page, the auth API and Next's own internals.
 *  The scoped asset path is deliberately NOT excluded: it is what is protected. */
export const proxyMatcher = ["/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)"];

export default proxy;
