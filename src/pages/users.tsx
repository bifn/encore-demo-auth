import { listUsers } from "../db/users";
import { getSession } from "../session";
import { failuresSince, recent } from "../db/authlog";
import { cfg } from "../config";
import { can, roles } from "../permissions";
import UserAdmin from "./user-admin";
import AuthLog from "./auth-log";

export default async function UsersPage() {
  const session = await getSession();
  if (!session) return null;
  const [users, log, failures] = await Promise.all([listUsers(), recent(60), failuresSince(24)]);
  const c = cfg();
  const scopeLabel = c.scopes.label;

  return (
    <main style={{ maxWidth: 940, margin: "0 auto", padding: "48px 20px" }}>
      <div className="kicker">Administrator</div>
      <h1 style={{ marginTop: 6 }}>Who can open this</h1>
      <hr className="rule" />
      <p className="muted" style={{ marginTop: -6 }}>
        {c.scopes.list.length > 0
          ? `A narrow role sees one ${scopeLabel.toLowerCase()} and cannot reach another. A wide role sees every ${scopeLabel.toLowerCase()} and still cannot add anybody: granting access is this page, and this page is for administrators only.`
          : "Granting access is this page, and this page is for administrators only."}
      </p>
      <UserAdmin
        users={users}
        scopes={c.scopes.list}
        scopeLabel={scopeLabel}
        roleOptions={roles()}
        wideRoles={roles().filter((r) => can(r, "scope.all"))}
        selfId={session.uid}
        failures={failures}
      />
      <AuthLog rows={log} />
      <p style={{ marginTop: 22 }}><a href="/app">Back to the app</a></p>
    </main>
  );
}
