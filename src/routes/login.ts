import { NextResponse } from "next/server";
import { authenticate } from "../accounts.ts";
import { createToken, sessionCookie, sessionTtlSeconds } from "../tokens.ts";
import { record } from "../db/authlog.ts";

export async function POST(req: Request) {
  const { username, password } = (await req.json().catch(() => ({}))) as {
    username?: string; password?: string;
  };

  const auth = await authenticate(username ?? "", password ?? "");
  if (!auth.ok) {
    await record({
      event: auth.reason === "unknown_user" ? "login.unknown_user" : "login.bad_password",
      username: username ?? null,
      headers: req.headers,
    });
    // One message for both cases, or the form is a way to enumerate the roster.
    return NextResponse.json({ error: "That email and password do not match." }, { status: 401 });
  }

  await record({ event: "login.ok", username: auth.session.username, headers: req.headers });

  const ttl = sessionTtlSeconds();
  const token = await createToken({ ...auth.session, exp: Math.floor(Date.now() / 1000) + ttl });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ttl,
  });
  return res;
}
