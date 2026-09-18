import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { cfg } from "../config";
import { getUserById, setPassword } from "../db/users";
import { consume, findUsable } from "../db/resets";
import { record } from "../db/authlog";
import { PASSWORD_MIN_LENGTH } from "../constants";

export async function POST(req: Request) {
  if (!cfg().passwordReset?.enabled) {
    return NextResponse.json({ error: "Not available." }, { status: 404 });
  }

  const { token, next } = (await req.json().catch(() => ({}))) as {
    token?: string; next?: string;
  };

  if (!next || next.length < PASSWORD_MIN_LENGTH) {
    return NextResponse.json(
      { error: `That is ${next?.length ?? 0} characters. Use ${PASSWORD_MIN_LENGTH} or more, and nothing has been changed.` },
      { status: 400 },
    );
  }

  // One message for expired, already used, and never existed. Telling them
  // apart tells somebody holding a stolen link which kind of stolen it is.
  const row = token ? await findUsable(token) : null;
  if (!row) {
    await record({ event: "password.reset_rejected", headers: req.headers });
    return NextResponse.json(
      { error: "That link has expired or has already been used. Ask for another." },
      { status: 400 },
    );
  }

  const user = await getUserById(row.userId);
  if (!user || !user.active) {
    await record({ event: "password.reset_rejected", username: user?.username, headers: req.headers });
    return NextResponse.json(
      { error: "That link has expired or has already been used. Ask for another." },
      { status: 400 },
    );
  }

  await setPassword(user.id, await bcrypt.hash(next, 12));
  // Consumes this token and every other outstanding one for that account, so a
  // second link in somebody's inbox is dead the moment the first is used.
  await consume(row.id, user.id);
  await record({ event: "password.reset_used", username: user.username, headers: req.headers });

  return NextResponse.json({ ok: true });
}
