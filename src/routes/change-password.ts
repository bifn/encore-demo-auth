import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession } from "../session";
import { getLoginAuth, setPassword } from "../db/users";
import { record } from "../db/authlog";
import { PASSWORD_MIN_LENGTH } from "../constants";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { current, next } = (await req.json().catch(() => ({}))) as {
    current?: string; next?: string;
  };
  // Checked here as well as in the form, because the form is a convenience and
  // this is the control.
  if (!next || next.length < PASSWORD_MIN_LENGTH) {
    return NextResponse.json(
      { error: `That is ${next?.length ?? 0} characters. Use ${PASSWORD_MIN_LENGTH} or more, and nothing has been changed.` },
      { status: 400 },
    );
  }

  // Re-check the current password rather than trusting the session: a borrowed
  // laptop should not be enough to lock the owner out of their own account.
  const found = await getLoginAuth(session.username);
  if (!found || !(await bcrypt.compare(current ?? "", found.passwordHash))) {
    return NextResponse.json({ error: "That current password is wrong." }, { status: 403 });
  }

  // The form refuses this too, and the form is a convenience rather than a
  // control. Answering ok to a request that changed nothing is the same lie
  // this route was rewritten to stop telling.
  if (await bcrypt.compare(next, found.passwordHash)) {
    return NextResponse.json(
      { error: "That is the password you already have, and nothing has been changed." },
      { status: 400 },
    );
  }

  await setPassword(session.uid, await bcrypt.hash(next, 12));
  await record({ event: "password.changed", username: session.username, headers: req.headers });
  return NextResponse.json({ ok: true });
}
