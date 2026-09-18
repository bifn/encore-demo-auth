import { getSession } from "../session";
import ChangePassword from "./change-password-form";

export default async function AccountPage() {
  const session = await getSession();
  if (!session) return null;
  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "56px 20px" }}>
      <div className="kicker">Your account</div>
      <h1 style={{ marginTop: 6 }}>{session.name}</h1>
      <hr className="rule" />
      <div className="card">
        <h2>Change your password</h2>
        <p className="muted" style={{ margin: "2px 0 0" }}>
          Signed in as {session.username}, {session.role}.
        </p>
        <ChangePassword />
      </div>
      <p style={{ marginTop: 18 }}><a href="/app">Back to the app</a></p>
    </main>
  );
}
