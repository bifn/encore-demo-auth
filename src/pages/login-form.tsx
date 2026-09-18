"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "That did not work.");
      setBusy(false);
      return;
    }
    const next = params.get("next");
    router.replace(next && next.startsWith("/") ? next : "/app");
    router.refresh();
  }

  return (
    <form onSubmit={submit}>
      <label className="f">
        Email
        <input type="email" autoComplete="username" value={username}
          onChange={(e) => setUsername(e.target.value)} required />
      </label>
      <label className="f">
        Password
        <input type="password" autoComplete="current-password" value={password}
          onChange={(e) => setPassword(e.target.value)} required />
      </label>
      {error ? <div className="err">{error}</div> : null}
      <button className="primary" type="submit" disabled={busy}>
        {busy ? "Signing in" : "Sign in"}
      </button>
    </form>
  );
}
