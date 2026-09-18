/* SendGrid delivery over the REST API, so the package carries no mail
 * dependency of its own and a consumer inherits nothing it did not ask for.
 *
 * Fail-soft: when SENDGRID_API_KEY or EMAIL_FROM are unset we do not throw. We
 * log a breadcrumb with the recipient and subject only, and return
 * delivered:false.
 *
 * We never log the reset URL or the token. A reset link is a single-use account
 * takeover and must not land in server logs.
 *
 * The status matters as much as the outcome. "not_configured" is a
 * deterministic deployment state; "error" is a configured send that failed at
 * runtime. They must never be conflated, because the unauthenticated forgot
 * flow may surface a link only on the former. A transient failure handing a
 * live token back to whoever submitted the form is a pre-auth takeover.
 */

export type DeliveryStatus = "sent" | "not_configured" | "error";

export interface DeliveryResult {
  delivered: boolean;
  status: DeliveryStatus;
}

export interface ResetEmailInput {
  to: string;
  name: string;
  /** Where they set a new password. Single use, and never logged. */
  resetUrl: string;
  /** What this app is called, for the subject and the body. */
  brand: string;
  /** How long the link lasts, in words: "an hour", not "60 minutes". */
  expiresIn: string;
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] || full;
}

function renderHtml({ name, resetUrl, brand, expiresIn }: ResetEmailInput): string {
  return `<!doctype html>
<html>
  <body style="margin:0; padding:0; background:#f4f4f4;">
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; line-height:1.6; color:#3f3f3f; max-width:520px; margin:0 auto; padding:32px 24px; background:#ffffff;">
      <div style="text-transform:uppercase; letter-spacing:0.14em; font-size:11px; color:#8c8c8c; font-weight:700;">${brand}</div>
      <div style="height:3px; margin:14px 0 22px; background:linear-gradient(90deg,#f58020,#ed2024);"></div>
      <p style="margin:0 0 16px;">Hi ${firstName(name)},</p>
      <p style="margin:0 0 20px;">Here is your link to set a new password. It works once, and it lasts ${expiresIn}.</p>
      <p style="margin:0 0 24px;">
        <a href="${resetUrl}" style="display:inline-block; background:#1a1a1a; color:#ffffff; text-decoration:none; padding:13px 22px; border-radius:4px; font-weight:600; font-size:15px;">Set a new password</a>
      </p>
      <p style="margin:0 0 16px; color:#3f3f3f;">Your current password keeps working until you use this, so nothing has changed yet.</p>
      <p style="margin:0; color:#8c8c8c; font-size:13px;">If you did not ask for this, you can ignore it. Your email address on its own is not enough to get anybody in.</p>
    </div>
  </body>
</html>`;
}

function renderText({ name, resetUrl, brand, expiresIn }: ResetEmailInput): string {
  return [
    `Hi ${firstName(name)},`,
    "",
    `Here is your link to set a new password for ${brand}. It works once, and it lasts ${expiresIn}.`,
    "",
    resetUrl,
    "",
    "Your current password keeps working until you use this, so nothing has changed yet.",
    "",
    "If you did not ask for this, you can ignore it. Your email address on its own is not enough to get anybody in.",
  ].join("\n");
}

export function renderResetHtml(i: ResetEmailInput): string {
  return renderHtml(i);
}
export function renderResetText(i: ResetEmailInput): string {
  return renderText(i);
}

export async function sendPasswordResetEmail(input: ResetEmailInput): Promise<DeliveryResult> {
  const key = process.env.SENDGRID_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    console.warn("[demo-auth] no mail configured, so nothing was sent to %s", input.to);
    return { delivered: false, status: "not_configured" };
  }

  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: input.to, name: input.name }] }],
        from: { email: from, name: process.env.EMAIL_FROM_NAME || input.brand },
        subject: `Set a new password for ${input.brand}`,
        content: [
          { type: "text/plain", value: renderText(input) },
          { type: "text/html", value: renderHtml(input) },
        ],
      }),
    });
    if (!res.ok) {
      // Status and recipient only. Never the body, which carries the link.
      console.error("[demo-auth] mail rejected for %s: %s", input.to, res.status);
      return { delivered: false, status: "error" };
    }
    return { delivered: true, status: "sent" };
  } catch (err) {
    console.error("[demo-auth] mail threw for %s: %s", input.to, err);
    return { delivered: false, status: "error" };
  }
}
