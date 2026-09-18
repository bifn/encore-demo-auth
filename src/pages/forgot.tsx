import { cfg } from "../config";
import ForgotForm from "./forgot-form";

export default function ForgotPage() {
  const c = cfg();
  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: "64px 20px" }}>
      <div className="kicker">{c.org}</div>
      <h1 style={{ marginTop: 6 }}>{c.name}</h1>
      <hr className="rule" />
      <div className="card">
        <h2>Forgot your password</h2>
        <p className="muted" style={{ margin: "2px 0 0" }}>
          Tell us the address you sign in with and we will email you a link. Your current
          password keeps working until you use it.
        </p>
        <ForgotForm />
      </div>
      <p style={{ marginTop: 18 }}><a href="/login">Back to sign in</a></p>
    </main>
  );
}
