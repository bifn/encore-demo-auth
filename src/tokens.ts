/* Stateless session tokens: HMAC-SHA256 signed payloads, verifiable with only a
 * shared secret. No database call and no external call, so this works the same
 * in the proxy runtime, route handlers and Server Components.
 *
 * Must not import next/headers: the proxy bundle imports this file. */
import { cfg } from "./config";

export interface SessionPayload {
  uid: string;
  username: string;
  name: string;
  initials: string;
  role: string;
  /** The slice this session may open: a scope key, or "all". */
  scope: string;
  exp: number;
}

const encoder = new TextEncoder();

export function sessionCookie(): string {
  return cfg().cookieName;
}
export function sessionTtlSeconds(): number {
  return 60 * 60 * cfg().sessionHours;
}

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) {
    // Loud rather than silent: unset in production would mean every deployment
    // signs with the same well-known string.
    if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is not set");
    return "dev-only-secret-set-AUTH_SECRET-in-your-host";
  }
  return s;
}

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): string {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  return atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return b64url(await crypto.subtle.sign("HMAC", key, encoder.encode(data)));
}

export async function createToken(payload: SessionPayload): Promise<string> {
  const body = b64url(encoder.encode(JSON.stringify(payload)));
  return `${body}.${await hmac(body)}`;
}

export async function verifyToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  if ((await hmac(body)) !== token.slice(dot + 1)) return null;
  try {
    const payload = JSON.parse(fromB64url(body)) as SessionPayload;
    if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
