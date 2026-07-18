"use server";

import { signIn } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getResendClient } from "@/lib/resend";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function loginAction(
  email: string,
  password: string,
  redirectTo = "/dashboard"
): Promise<{ error: string } | { success: true }> {
  // redirect: false keeps Auth.js from calling next/navigation's redirect()
  // itself. Auth.js builds that redirect URL from AUTH_URL/baseUrl, which
  // drifts to the old goal-app-3.onrender.com host in production for the
  // credentials-error path (unlike the success path, it doesn't run through
  // our custom `redirect` callback in lib/auth.ts). A redirect to that other
  // origin from inside a Server Action fails client-side as a generic fetch
  // error. Resolving the URL ourselves and only ever redirecting to a
  // relative path sidesteps the cross-origin redirect entirely.
  let result: string;
  try {
    result = await signIn("credentials", { email, password, redirectTo, redirect: false });
  } catch {
    return { error: "Something went wrong. Please try again." };
  }

  if (result.includes("error=")) {
    return { error: "Invalid email or password." };
  }

  redirect(redirectTo);
}

export async function requestPasswordReset(
  email: string
): Promise<{ error: string } | { success: true }> {
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.email) return { success: true };

    await prisma.passwordResetToken.deleteMany({ where: { email: user.email } });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    await prisma.passwordResetToken.create({
      data: {
        email: user.email,
        token: hashedToken,
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const appUrl = (process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "https://goal-app-3.onrender.com").replace(/\/$/, "");
    const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

    const result = await getResendClient().emails.send({
      from: process.env.FROM_EMAIL ?? "noreply@nivarro.co",
      to: user.email,
      subject: "Reset your Nivarro password",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#080809;border-radius:8px">
          <div style="margin-bottom:20px">
            <span style="font-family:sans-serif;font-size:13px;letter-spacing:0.12em;color:#fff;font-weight:700">NI<span style="color:#E8893A">VARRO</span></span>
          </div>
          <h2 style="color:#fff;margin-bottom:8px;font-size:20px;font-weight:600">Reset your password</h2>
          <p style="color:#909098;margin-bottom:24px;font-size:14px;line-height:1.6">
            Click the button below to set a new password. This link expires in 1 hour.
          </p>
          <a href="${resetUrl}"
             style="display:inline-block;background:#E8893A;color:#000;font-weight:700;
                    text-decoration:none;padding:12px 28px;border-radius:0;font-size:13px;
                    letter-spacing:0.08em;text-transform:uppercase">
            Reset Password
          </a>
          <p style="color:#58586a;font-size:12px;margin-top:28px">
            If you didn't request this, you can ignore this email.
          </p>
        </div>
      `,
    });

    if (result.error) {
      console.error("[requestPasswordReset] Resend error:", result.error);
      return { error: `Email failed: ${result.error.message}` };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[requestPasswordReset] Unexpected error:", msg);
    return { error: msg };
  }
}

export async function resetPassword(
  token: string,
  password: string
): Promise<{ error: string } | { success: true }> {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const record = await prisma.passwordResetToken.findUnique({
    where: { token: hashedToken },
  });

  if (!record) return { error: "Invalid or expired link." };

  if (record.expires < new Date()) {
    await prisma.passwordResetToken.delete({ where: { token: hashedToken } });
    return { error: "Link has expired. Request a new one." };
  }

  const user = await prisma.user.findUnique({ where: { email: record.email } });
  if (!user) return { error: "Account not found." };

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.delete({ where: { token: hashedToken } }),
  ]);

  return { success: true };
}
