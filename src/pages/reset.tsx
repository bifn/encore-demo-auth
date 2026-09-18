import { Suspense } from "react";
import { cfg } from "../config";
import ResetForm from "./reset-form";

export default function ResetPage() {
  const c = cfg();
  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: "64px 20px" }}>
      <div className="kicker">{c.org}</div>
      <h1 style={{ marginTop: 6 }}>{c.name}</h1>
      <hr className="rule" />
      <div className="card">
        <h2>Set a new password</h2>
        <Suspense fallback={null}>
          <ResetForm />
        </Suspense>
      </div>
      <p style={{ marginTop: 18 }}><a href="/login">Back to sign in</a></p>
    </main>
  );
}
