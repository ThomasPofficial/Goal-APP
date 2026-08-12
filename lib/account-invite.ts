import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { sendInviteEmail } from "@/lib/invite-email";

export type CreateAccountInviteArgs = {
  email: string;
  name?: string;
};

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Creates (or replaces) an activation token for the given email and
 * returns the link a teacher can hand to that person. Reuses the same
 * PasswordResetToken table and resetPassword() claim flow used for
 * ordinary password resets — activation is just a first-time claim.
 */
export async function createAccountInvite(
  args: CreateAccountInviteArgs
): Promise<{ activateUrl: string }> {
  const email = args.email.trim();

  await prisma.passwordResetToken.deleteMany({ where: { email } });

  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

  await prisma.passwordResetToken.create({
    data: {
      email,
      token: hashedToken,
      expires: new Date(Date.now() + INVITE_EXPIRY_MS),
    },
  });

  const appUrl = (
    process.env.NEXTAUTH_URL ??
    process.env.AUTH_URL ??
    "https://goal-app-3.onrender.com"
  ).replace(/\/$/, "");
  const activateUrl = `${appUrl}/activate-account?token=${rawToken}`;

  await sendInviteEmail({ to: email, name: args.name, activateUrl });

  return { activateUrl };
}
