import type { AuthLogRow } from "../db/authlog.ts";

/* What the log is for: when somebody says a password stopped working, or a
 * person who should not have reached a territory did, this is the record that
 * answers it. Plain language rather than event keys, because the person reading
 * it is an administrator and not the author of the schema. */
const SAID: Record<string, string> = {
  "login.ok": "signed in",
  "login.bad_password": "wrong password",
  "login.unknown_user": "no such address",
  "login.inactive": "account switched off",
  logout: "signed out",
  "password.changed": "changed their own password",
  "password.reset_by_admin": "password reset by an administrator",
  "user.created": "login created",
  "user.activated": "switched on",
  "user.deactivated": "switched off",
  "user.edited": "role or territory changed",
};

const BAD = new Set(["login.bad_password", "login.unknown_user", "login.inactive"]);

export default function AuthLog({ rows }: { rows: AuthLogRow[] }) {
  return (
    <section style={{ marginTop: 34 }}>
      <h2>What has happened</h2>
      <p className="muted" style={{ margin: "2px 0 12px" }}>
        Every sign-in attempt and every change to a login, newest first. Nothing here records a
        password. It exists so a credential that stops working has an account of itself rather
        than a shrug.
      </p>
      {rows.length === 0 ? (
        <p className="muted">Nothing recorded yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>What</th>
              <th>Where from</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="muted" style={{ whiteSpace: "nowrap" }}>
                  {new Date(r.at).toLocaleString()}
                </td>
                <td>{r.username ?? "unknown"}</td>
                <td style={{ color: BAD.has(r.event) ? "var(--red)" : undefined }}>
                  {SAID[r.event] ?? r.event}
                  {r.actor && r.actor !== r.username ? (
                    <span className="muted"> · by {r.actor}</span>
                  ) : null}
                </td>
                <td className="muted">{r.ip ?? "unknown"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
