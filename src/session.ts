/* Session reader for Server Components and route handlers. Imports next/headers,
 * so it must not reach the proxy bundle: the proxy reads the cookie off the
 * request and calls verifyToken directly. */
import { cookies } from "next/headers";
import { sessionCookie, verifyToken, type SessionPayload } from "./tokens.ts";

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifyToken(store.get(sessionCookie())?.value);
}
