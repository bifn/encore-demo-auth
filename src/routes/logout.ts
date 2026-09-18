import { NextResponse } from "next/server";
import { sessionCookie } from "../tokens.ts";
import { getSession } from "../session.ts";
import { record } from "../db/authlog.ts";

export async function POST(req: Request) {
  const session = await getSession();
  if (session) await record({ event: "logout", username: session.username, headers: req.headers });
  const res = NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  res.cookies.set(sessionCookie(), "", { path: "/", maxAge: 0 });
  return res;
}
