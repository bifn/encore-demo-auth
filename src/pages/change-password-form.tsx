"use client";

import { useState } from "react";

export default function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ current, next }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setMsg(
      res.ok
        ? { ok: true, text: "Changed. It applies the next time you sign in." }
        : { ok: false, text: body.error ?? "That did not work." },
    );
    if (res.ok) {
      setCurrent("");
      setNext("");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit}>
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
          minLength={12}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
        />
        <span className="muted">Twelve characters or more.</span>
      </label>
      {msg ? <div className={msg.ok ? "ok" : "err"}>{msg.text}</div> : null}
      <button className="primary" type="submit" disabled={busy}>
        {busy ? "Saving" : "Change password"}
      </button>
    </form>
  );
}
