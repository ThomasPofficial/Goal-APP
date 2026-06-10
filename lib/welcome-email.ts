import { getResendClient } from "@/lib/resend";

export type WelcomeEmailArgs = {
  to: string;
  name?: string;
};

/**
 * Send the welcome email. Pure side-effect; throws on hard failures so
 * callers can decide whether to surface or swallow.
 */
export async function sendWelcomeEmail(
  args: WelcomeEmailArgs
): Promise<{ id: string | null }> {
  const from = process.env.FROM_EMAIL ?? "noreply@nivarro.co";
  const appUrl = process.env.AUTH_URL ?? "https://nivarro.co";
  const greetingName = args.name?.trim() || "there";

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1f">
      <h2 style="color:#4a80f0;margin-bottom:8px">Welcome to Nivarro, ${escapeHtml(greetingName)}</h2>
      <p style="color:#58586a;line-height:1.55;margin:0 0 16px">
        Glad you're here. Nivarro helps you find scholars, run projects, and keep your work moving.
      </p>
      <p style="margin:0 0 24px">
        <a href="${appUrl}/dashboard"
           style="display:inline-block;background:#4a80f0;color:#fff;font-weight:600;
                  text-decoration:none;padding:12px 24px;border-radius:6px">
          Open your dashboard
        </a>
      </p>
      <p style="color:#909098;font-size:13px;line-height:1.5;margin:0">
        Reply to this email if you get stuck — a real human reads it.
      </p>
    </div>
  `;

  const result = await getResendClient().emails.send({
    from,
    to: args.to,
    subject: "Welcome to Nivarro",
    html,
  });

  if (result.error) {
    throw new Error(`Welcome email failed: ${result.error.message}`);
  }
  return { id: result.data?.id ?? null };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
