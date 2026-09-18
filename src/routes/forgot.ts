import { NextResponse } from "next/server";
import { cfg } from "../config";
import { getLoginAuth } from "../db/users";
import { issueToken, recentRequests, TOKEN_TTL_MINUTES } from "../db/resets";
import { record } from "../db/authlog";
import { sendPasswordResetEmail } from "../email";

export const RATE_LIMIT_PER_HOUR = 3;

/* Unauthenticated, so it answers the same way to everyone.
 *
 * The response never varies on whether the address exists, whether the account
 * is active, or whether the rate limit bit. Any of those leaking turns this
 * form into a way to enumerate the roster, which is the thing the login screen
 * is already careful about. */
const SAME_ANSWER = {
  ok: true,
  message: "If that address has an account, a link is on its way.",
};

function originOf(req: Request): string {
  const h = req.headers;
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  return `${proto}://${host}`;
}

export async function POST(req: Request) {
  const c = cfg();
  if (!c.passwordReset?.enabled) {
    return NextResponse.json({ error: "Not available." }, { status: 404 });
  }

  const { username } = (await req.json().catch(() => ({}))) as { username?: string };
  const address = (username ?? "").trim().toLowerCase();

  const found = await getLoginAuth(address);
  if (!found) {
    // Recorded so somebody working through a list leaves a trail, even though
    // the answer they get is the same as everybody else's.
    await record({ event: "password.reset_requested", username: address, headers: req.headers });
    return NextResponse.json(SAME_ANSWER);
  }

  if ((await recentRequests(found.user.id)) >= RATE_LIMIT_PER_HOUR) {
    await record({ event: "password.reset_throttled", username: address, headers: req.headers });
    return NextResponse.json(SAME_ANSWER);
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const token = await issueToken(found.user.id, ip);
  const resetUrl = `${originOf(req)}/reset?token=${encodeURIComponent(token)}`;

  const { status } = await sendPasswordResetEmail({
    to: found.user.username,
    name: found.user.name,
    resetUrl,
    brand: c.name,
    expiresIn: TOKEN_TTL_MINUTES === 60 ? "an hour" : `${TOKEN_TTL_MINUTES} minutes`,
  });

  await record({ event: "password.reset_requested", username: address, headers: req.headers });

  /* The link comes back in the response only when mail is not configured at
   * all, and never in production. That distinction is the whole point of the
   * status: a configured send that fails at runtime must not hand a live token
   * to whoever submitted this form, because this form is unauthenticated and
   * the requester is not necessarily the account holder. */
  const showLink = status === "not_configured" && process.env.NODE_ENV !== "production";
  return NextResponse.json(showLink ? { ...SAME_ANSWER, devResetUrl: resetUrl } : SAME_ANSWER);
}
