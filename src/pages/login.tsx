import { Suspense } from "react";
import { cfg } from "../config";
import LoginForm from "./login-form";

export default function LoginPage() {
  const c = cfg();
  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: "64px 20px" }}>
      <div className="kicker">{c.org}</div>
      <h1 style={{ marginTop: 6 }}>{c.name}</h1>
      <hr className="rule" />
      <div className="card">
        <h2>Sign in</h2>
        {c.description ? (
          <p className="muted" style={{ margin: "2px 0 0" }}>{c.description}</p>
        ) : null}
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
      {c.note ? (
        <p className="muted" style={{ marginTop: 18 }}>{c.note}</p>
      ) : null}
    </main>
  );
}
