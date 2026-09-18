"use client";

import { useState } from "react";

export default function ForgotForm() {
  const [username, setUsername] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [devUrl, setDevUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      message?: string; devResetUrl?: string;
    };
    // The answer is the same whether or not that address has an account, so
    // this form cannot be used to find out who does.
    setSent(body.message ?? "If that address has an account, a link is on its way.");
    setDevUrl(body.devResetUrl ?? null);
    setBusy(false);
  }

  if (sent) {
    return (
      <>
        <div className="ok" style={{ marginTop: 16 }}>
          {sent}
          <br />
          The link works once and lasts an hour. If it is not there in a minute or two, check
          your spam folder before asking for another.
        </div>
        {devUrl ? (
          <div className="err" style={{ marginTop: 12 }}>
            Mail is not configured here, so the link is below rather than in an inbox. This
            only ever happens outside production.
            <br />
            <a href={devUrl}>{devUrl}</a>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <form onSubmit={submit}>
      <label className="f">
        Email
        <input
          type="email"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
      </label>
      <button className="primary" type="submit" disabled={busy}>
        {busy ? "Sending" : "Send me a link"}
      </button>
    </form>
  );
}
