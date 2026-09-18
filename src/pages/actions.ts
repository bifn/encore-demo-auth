"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { getSession } from "../session";
import { can, roles } from "../permissions";
import { cfg, isScoped } from "../config";
import {
  createUser, getUserById, setActive, setPassword, updateUser, usernameExists,
} from "../db/users";
import { record } from "../db/authlog";

/* Every action re-checks the permission on the server. The proxy already keeps
 * non-admins off these pages, but a server action is a callable endpoint: the
 * page not rendering a button is not a control. */
async function requireAdmin() {
  const session = await getSession();
  if (!session || !can(session.role, "users.manage")) {
    throw new Error("Managing users is for administrators only.");
  }
  return session;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "??";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return ((parts[0][0] ?? "") + last).toUpperCase();
}

function validate(role: string, scope: string) {
  if (!roles().includes(role)) throw new Error("Unknown role.");
  if (!isScoped()) return;
  const keys = cfg().scopes.list.map((s) => s.key);
  // A narrow role owns exactly one slice; the wide roles see all of them, and
  // storing a slice against those would be a lie in the row.
  if (can(role, "scope.all")) {
    if (scope !== "all") throw new Error("That role sees everything.");
  } else if (!keys.includes(scope)) {
    throw new Error(`Pick the ${cfg().scopes.label.toLowerCase()} this person owns.`);
  }
}

export async function addUser(form: FormData): Promise<{ error?: string; password?: string }> {
  try {
    const admin = await requireAdmin();
    const name = String(form.get("name") ?? "").trim();
    const username = String(form.get("username") ?? "").trim().toLowerCase();
    const role = String(form.get("role") ?? "");
    const scope = String(form.get("scope") ?? "all");
    if (!name || !username) return { error: "Name and email are both needed." };
    validate(role, scope);
    if (await usernameExists(username)) return { error: "That email already has a login." };

    // Generated rather than chosen, and shown once: an administrator typing a
    // password for somebody else is how four accounts end up sharing one.
    const password = randomUUID().replace(/-/g, "").slice(0, 14);
    await createUser({
      id: `u-${randomUUID().slice(0, 8)}`,
      username, name, initials: initialsFor(name), role, scope,
      passwordHash: await bcrypt.hash(password, 12),
    });
    await record({ event: "user.created", username, actor: admin.username });
    revalidatePath("/users");
    return { password };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That did not work." };
  }
}

export async function toggleActive(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(form.get("id") ?? "");
  const active = String(form.get("active") ?? "") === "true";
  // Switching off your own account mid-demo is not a recoverable mistake.
  if (admin.uid === id && !active) return;
  await setActive(id, active);
  await record({
    event: active ? "user.activated" : "user.deactivated",
    username: (await getUserById(id))?.username ?? null,
    actor: admin.username,
  });
  revalidatePath("/users");
}

export async function resetPassword(form: FormData): Promise<{ password?: string; error?: string }> {
  try {
    const admin = await requireAdmin();
    const id = String(form.get("id") ?? "");
    const password = randomUUID().replace(/-/g, "").slice(0, 14);
    await setPassword(id, await bcrypt.hash(password, 12));
    await record({
      event: "password.reset_by_admin",
      username: (await getUserById(id))?.username ?? null,
      actor: admin.username,
    });
    revalidatePath("/users");
    return { password };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That did not work." };
  }
}

export async function editUser(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const role = String(form.get("role") ?? "");
  const scope = String(form.get("scope") ?? "all");
  validate(role, scope);
  await updateUser(id, { name, role, scope, initials: initialsFor(name) });
  await record({
    event: "user.edited",
    username: (await getUserById(id))?.username ?? null,
    actor: admin.username,
  });
  revalidatePath("/users");
}
