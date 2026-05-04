"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getResendClient } from "@/lib/resend";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function loginAction(
  email: string,
  password: string
): Promise<{ error: string } | { success: true }> {
  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (error) {
    const digest = (error as { digest?: string })?.digest ?? "";
    if (digest.startsWith("NEXT_REDIRECT")) {
      const redirectUrl = digest.split(";")[2] ?? "";
      if (redirectUrl.includes("/dashboard")) {
        return { success: true };
      }
      return { error: "Invalid email or password." };
    }
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    return { error: "Something went wrong. Please try again." };
  }
  return { success: true };
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

    const resetUrl = `${process.env.AUTH_URL}/reset-password?token=${rawToken}`;

    const result = await getResendClient().emails.send({
      from: process.env.FROM_EMAIL ?? "noreply@nivarro.co",
      to: user.email,
      subject: "Reset your Nivarro password",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#c9a84c;margin-bottom:8px">Reset your password</h2>
          <p style="color:#909098;margin-bottom:24px">
            Click the button below to set a new password. This link expires in 1 hour.
          </p>
          <a href="${resetUrl}"
             style="display:inline-block;background:#c9a84c;color:#080809;font-weight:600;
                    text-decoration:none;padding:12px 24px;border-radius:6px">
            Reset Password
          </a>
          <p style="color:#58586a;font-size:12px;margin-top:24px">
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
    console.error("[requestPasswordReset] Unexpected error:", err);
    return { error: "Something went wrong. Please try again." };
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
