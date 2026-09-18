"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { PASSWORD_MIN_LENGTH } from "../constants";

export default function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
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
    setBusy(true);
    const res = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, next }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setMsg(
      res.ok
        ? { ok: true, text: "Your new password is set." }
        : { ok: false, text: body.error ?? "That did not work, and nothing has been changed." },
    );
    if (res.ok) setNext("");
    setBusy(false);
  }

  if (!token) {
    return (
      <div className="err">
        This link is missing the part that identifies it, so it cannot be used.{" "}
        <a href="/forgot">Ask for a new one</a>.
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
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
      {msg?.ok ? (
        <p style={{ marginTop: 14 }}><a href="/login">Sign in with it</a></p>
      ) : (
        <button className="primary" type="submit" disabled={busy}>
          {busy ? "Saving" : "Set the password"}
        </button>
      )}
    </form>
  );
}
