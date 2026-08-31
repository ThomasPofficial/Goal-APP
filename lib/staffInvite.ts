import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { resetPassword } from "@/app/actions/auth";
import type { Capability } from "@/lib/facultyPermissions";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function baseUrl() {
  return process.env.AUTH_URL ?? "https://app.nivarro.co";
}

function hasAnyStaffAssignment(profile: { staffTierId: string | null; staffPermissionOverrides: string }) {
  if (profile.staffTierId) return true;
  try {
    const parsed = JSON.parse(profile.staffPermissionOverrides);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

export async function createStaffInvite(args: {
  email: string;
  schoolId: string;
  tierId?: string | null;
  customPermissions?: Capability[];
  staffTitle?: string;
  displayName?: string;
  // Only ever used to PROMOTE (true) via this path — never demotes an existing
  // Core Admin as a side effect of an unrelated invite/edit. Demotion is only
  // ever explicit, via PATCH /api/school/admins/[userId].
  isCoreAdmin?: boolean;
}): Promise<{ status: "invited"; link: string } | { status: "already-staff" }> {
  const email = args.email.trim().toLowerCase();
  const overridesJson = JSON.stringify(args.customPermissions ?? []);

  const existing = await prisma.user.findUnique({ where: { email }, include: { profile: true } });

  if (existing?.role && !["STUDENT", "STAFF"].includes(existing.role)) {
    throw new Error("This email already belongs to a different account type");
  }

  // Cross-tenant guard. If this account is already attached to a DIFFERENT school
  // (another school's roster student, or staff at another school), writing our
  // tier/overrides onto their profile would leave schoolId pointing at their real
  // school — requireSchoolCapability returns profile.schoolId for STAFF, so they'd
  // end up wielding OUR chosen permissions against THAT school's data. Refuse.
  if (existing?.profile?.schoolId && existing.profile.schoolId !== args.schoolId) {
    throw new Error("This email already belongs to another school");
  }

  if (existing?.role === "STAFF") {
    // Already has a working login — just update their tier/overrides, no token needed.
    // A User can exist without a Profile (e.g. Google OAuth sign-in before
    // onboarding creates one), so branch on whether one exists already
    // rather than assuming `update` will find a row.
    // schoolId is written on the update path too (not just create): a profile whose
    // schoolId is null would leave requireSchoolCapability unable to authorize this
    // account for anything once they're STAFF. The cross-school guard above already
    // proved any pre-existing schoolId equals args.schoolId, so this is a no-op there.
    const data = {
      schoolId: args.schoolId,
      staffTierId: args.tierId ?? null,
      staffPermissionOverrides: overridesJson,
      staffInvited: true,
      ...(args.staffTitle ? { staffTitle: args.staffTitle } : {}),
      ...(args.displayName?.trim() ? { displayName: args.displayName.trim() } : {}),
      ...(args.isCoreAdmin === true ? { isCoreAdmin: true } : {}),
    };
    if (existing.profile) {
      await prisma.profile.update({ where: { userId: existing.id }, data });
    } else {
      await prisma.profile.create({
        data: {
          userId: existing.id,
          displayName: existing.name ?? email,
          staffTitle: args.staffTitle ?? null,
          ...data,
        },
      });
    }
    return { status: "already-staff" };
  }

  let userId: string;
  if (existing) {
    // Same no-Profile-yet possibility as above.
    // Same reasoning as the already-staff branch: this is the "promote an existing
    // plain student/alumni account to staff" path, where schoolId is typically null
    // and MUST be stamped or every capability check fails after they accept.
    const data = {
      schoolId: args.schoolId,
      staffTierId: args.tierId ?? null,
      staffPermissionOverrides: overridesJson,
      staffInvited: true,
      ...(args.staffTitle ? { staffTitle: args.staffTitle } : {}),
      ...(args.displayName?.trim() ? { displayName: args.displayName.trim() } : {}),
      ...(args.isCoreAdmin === true ? { isCoreAdmin: true } : {}),
    };
    if (existing.profile) {
      await prisma.profile.update({ where: { userId: existing.id }, data });
    } else {
      await prisma.profile.create({
        data: {
          userId: existing.id,
          displayName: existing.name ?? email,
          ...data,
        },
      });
    }
    userId = existing.id;
  } else {
    const created = await prisma.user.create({
      data: {
        email,
        name: args.displayName?.trim() || email,
        role: "STUDENT",
        profile: {
          create: {
            displayName: args.displayName?.trim() || email,
            schoolId: args.schoolId,
            staffTitle: args.staffTitle ?? null,
            staffTierId: args.tierId ?? null,
            staffPermissionOverrides: overridesJson,
            staffInvited: true,
            isCoreAdmin: args.isCoreAdmin === true,
            onboardingComplete: false,
          },
        },
      },
    });
    userId = created.id;
  }

  // Same dedup + token scheme as requestPasswordReset (app/actions/auth.ts),
  // just a 7-day expiry instead of 1 hour — this is a "get around to it"
  // invite, not an urgent security action.
  await prisma.passwordResetToken.deleteMany({ where: { email } });
  const rawToken = randomBytes(32).toString("hex");
  const hashedToken = createHash("sha256").update(rawToken).digest("hex");
  await prisma.passwordResetToken.create({
    data: { email, token: hashedToken, expires: new Date(Date.now() + INVITE_TTL_MS) },
  });

  const link = `${baseUrl()}/staff/accept-invite?token=${rawToken}`;
  await notifyInvite(email, link);

  return { status: "invited", link };
}

// Mocked: real email delivery is deferred. The caller (API route) returns
// `link` directly in the response so the inviter can copy/send it manually.
// Swap this function's body for a lib/resend.ts call to go live later —
// nothing else in the invite flow needs to change.
export async function notifyInvite(email: string, _link: string) {
  // Deliberately does NOT log the link: it carries the raw invite token, which is
  // credential-equivalent, and the host retains logs. The inviter gets the real
  // link from the API response — logs are noise, not a delivery channel.
  console.log(`[staff-invite mock] invite issued for ${email}`);
}

export async function checkStaffInviteToken(token: string): Promise<{ valid: true; email: string } | { valid: false; error: string }> {
  const hashedToken = createHash("sha256").update(token).digest("hex");
  const record = await prisma.passwordResetToken.findUnique({ where: { token: hashedToken } });
  if (!record) return { valid: false, error: "Invite not found" };
  if (record.expires < new Date()) return { valid: false, error: "Invite expired" };
  return { valid: true, email: record.email };
}

export async function acceptStaffInvite(args: {
  token: string;
  password: string;
  displayName?: string;
  staffTitle?: string;
}): Promise<{ error: string } | { userId: string }> {
  const result = await resetPassword(args.token, args.password);
  if ("error" in result) return result;

  const user = await prisma.user.findUnique({ where: { id: result.userId }, include: { profile: true } });
  if (!user?.profile) return { userId: result.userId };

  if (args.displayName || args.staffTitle) {
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        ...(args.displayName ? { displayName: args.displayName } : {}),
        ...(args.staffTitle ? { staffTitle: args.staffTitle } : {}),
      },
    });
  }

  // Only promote when this activation was a staff invite (signaled by
  // pre-existing tier/override data set at invite time), never for a plain
  // password reset — resetPassword itself has no concept of staff invites.
  if (user.role === "STUDENT" && hasAnyStaffAssignment(user.profile)) {
    await prisma.user.update({ where: { id: user.id }, data: { role: "STAFF" } });
  }

  return { userId: user.id };
}
