"use client";

import { useState } from "react";
import { PASSWORD_MIN_LENGTH } from "../constants";

/* The length rule used to live on the input as minLength, which is enforced by
 * the browser and nowhere the person can see. A short password simply did not
 * submit: a small native bubble, no message on the page, and the old password
 * still working afterwards. Somebody changed their password, was told nothing,
 * and found out days later that it had not changed.
 *
 * So the rule is stated before it is needed, checked here where the answer can
 * be shown, and checked again on the server where it is actually enforced. */
export default function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const short = next.length > 0 && next.length < PASSWORD_MIN_LENGTH;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (next.length < PASSWORD_MIN_LENGTH) {
      setMsg({
        ok: false,
        text: `That is ${next.length} characters. Use ${PASSWORD_MIN_LENGTH} or more, and nothing has been changed.`,
      });
      return;
    }
    if (next === current) {
      setMsg({ ok: false, text: "That is the password you already have." });
      return;
    }

    setBusy(true);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ current, next }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setMsg(
      res.ok
        ? { ok: true, text: "Changed. Use the new one the next time you sign in." }
        : { ok: false, text: body.error ?? "That did not work, and nothing has been changed." },
    );
    if (res.ok) {
      setCurrent("");
      setNext("");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} noValidate>
      <label className="f">
        Current password
        <input
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
      </label>
      <label className="f">
        New password
        <input
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
          aria-describedby="pw-rule"
          style={short ? { borderColor: "var(--red)" } : undefined}
        />
        <span id="pw-rule" className="muted" style={short ? { color: "var(--red)" } : undefined}>
          {next.length === 0
            ? `${PASSWORD_MIN_LENGTH} characters or more.`
            : short
              ? `${next.length} of ${PASSWORD_MIN_LENGTH} characters.`
              : `${next.length} characters. That will do.`}
        </span>
      </label>
      {msg ? <div className={msg.ok ? "ok" : "err"}>{msg.text}</div> : null}
      <button className="primary" type="submit" disabled={busy}>
        {busy ? "Saving" : "Change password"}
      </button>
    </form>
  );
}
