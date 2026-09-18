"use client";

import { useState } from "react";
import { addUser, editUser, resetPassword, toggleActive } from "./actions";

interface User {
  id: string;
  username: string;
  name: string;
  role: string;
  scope: string;
  active: boolean;
  lastSeenAt: string | null;
}
interface ScopeOption {
  key: string;
  label: string;
}



export default function UserAdmin({
  users,
  scopes,
  scopeLabel,
  roleOptions,
  wideRoles,
  selfId,
  failures,
}: {
  users: User[];
  scopes: ScopeOption[];
  /** What a slice is called here: "Territory", "Region", "Account". */
  scopeLabel: string;
  roleOptions: string[];
  /** Roles that see every slice, so the picker hides for them. */
  wideRoles: string[];
  selfId: string;
  /** Failed sign-in attempts per address in the last day, from the auth log. */
  failures: Record<string, number>;
}) {
  const ROLE_OPTIONS = roleOptions;
  const narrow = (r: string) => scopes.length > 0 && !wideRoles.includes(r);
  const [role, setRole] = useState(roleOptions[roleOptions.length - 1] ?? "");
  const [handout, setHandout] = useState<{ who: string; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const sliceFor = (u: User) =>
    u.scope === "all"
      ? `Every ${scopeLabel.toLowerCase()}`
      : (scopes.find((s) => s.key === u.scope)?.label ?? u.scope);

  return (
    <>
      <div className="card" style={{ marginBottom: 22 }}>
        <h2>Add somebody</h2>
        <form
          action={async (fd) => {
            setError(null);
            setHandout(null);
            const res = await addUser(fd);
            if (res.error) setError(res.error);
            else if (res.password)
              setHandout({ who: String(fd.get("name") ?? ""), password: res.password });
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <label className="f">
              Name
              <input type="text" name="name" required />
            </label>
            <label className="f">
              Email
              <input type="email" name="username" required />
            </label>
            <label className="f">
              Role
              <select name="role" value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <label className="f">
              {scopeLabel}
              {narrow(role) ? (
                <select name="scope" defaultValue={scopes[0]?.key}>
                  {scopes.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <input type="hidden" name="scope" value="all" />
                  <input type="text" value={`Every ${scopeLabel.toLowerCase()}`} disabled />
                </>
              )}
            </label>
          </div>
          {error ? <div className="err">{error}</div> : null}
          <button className="primary" type="submit">
            Create the login
          </button>
        </form>
        {handout ? (
          <div className="ok">
            <strong>{handout.who}</strong> can sign in with{" "}
            <code style={{ fontSize: 15, background: "#fff", padding: "2px 6px", border: "1px solid var(--line)" }}>
              {handout.password}
            </code>
            . This is the only time it is shown, so hand it over now. They can change it under
            Password.
          </div>
        ) : null}
      </div>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Territory</th>
            <th>Last in</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                {u.name}
                {u.id === selfId ? <span className="badge" style={{ marginLeft: 6 }}>You</span> : null}
                {!u.active ? <span className="badge off" style={{ marginLeft: 6 }}>Switched off</span> : null}
                {failures[u.username] ? (
                  <span className="badge off" style={{ marginLeft: 6 }}>
                    {failures[u.username]} failed {failures[u.username] === 1 ? "try" : "tries"} today
                  </span>
                ) : null}
                {editing === u.id ? (
                  <form
                    action={async (fd) => {
                      await editUser(fd);
                      setEditing(null);
                    }}
                    style={{ marginTop: 8 }}
                  >
                    <input type="hidden" name="id" value={u.id} />
                    <input type="text" name="name" defaultValue={u.name} required />
                    <select name="role" defaultValue={u.role} style={{ marginTop: 6 }}>
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                    <select name="scope" defaultValue={u.scope} style={{ marginTop: 6 }}>
                      <option value="all">{`Every ${scopeLabel.toLowerCase()}`}</option>
                      {scopes.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <button className="primary" type="submit" style={{ marginTop: 8 }}>
                      Save
                    </button>
                  </form>
                ) : null}
              </td>
              <td className="muted">{u.username}</td>
              <td>{u.role}</td>
              <td>{sliceFor(u)}</td>
              <td className="muted">
                {u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString() : "Never"}
              </td>
              <td style={{ whiteSpace: "nowrap" }}>
                <button className="link" onClick={() => setEditing(editing === u.id ? null : u.id)}>
                  {editing === u.id ? "Cancel" : "Edit"}
                </button>
                {" · "}
                <form
                  action={async (fd) => {
                    const res = await resetPassword(fd);
                    if (res.password) setHandout({ who: u.name, password: res.password });
                  }}
                  style={{ display: "inline" }}
                >
                  <input type="hidden" name="id" value={u.id} />
                  <button className="link" type="submit">
                    New password
                  </button>
                </form>
                {u.id !== selfId ? (
                  <>
                    {" · "}
                    <form action={toggleActive} style={{ display: "inline" }}>
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="active" value={String(!u.active)} />
                      <button className="link" type="submit">
                        {u.active ? "Switch off" : "Switch on"}
                      </button>
                    </form>
                  </>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
