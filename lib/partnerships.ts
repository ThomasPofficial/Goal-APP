import { prisma } from "@/lib/prisma";

export const PARTNERSHIP_WINDOW_MS = 48 * 60 * 60 * 1000;

/**
 * A user counts toward the "at least one alumni/staff" guardrail if they're
 * alumni or have a staff title. Mirrors the eligibility check historically
 * used by /api/connections/request.
 */
export async function isEligiblePartner(userId: string): Promise<boolean> {
  const [user, profile] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { isAlumni: true } }),
    prisma.profile.findUnique({ where: { userId }, select: { staffTitle: true } }),
  ]);
  return Boolean(user?.isAlumni) || Boolean(profile?.staffTitle);
}

export async function partnerUserSummary(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, profile: { select: { displayName: true, handle: true, avatarUrl: true } } },
  });
  return {
    id: userId,
    displayName: user?.profile?.displayName ?? user?.name ?? "Someone",
    handle: user?.profile?.handle ?? null,
    avatarUrl: user?.profile?.avatarUrl ?? null,
  };
}

export function buildGroupName(names: string[]): string {
  if (names.length === 0) return "Partnership";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

/**
 * Creates a MENTORSHIP-type conversation (NOT lib/communities.ts's
 * createPrivateRoom, which hardcodes type: 'COMMUNITY' — those rooms surface
 * on /communities, not /partnerships). Mirrors the shape used by the
 * school-admin direct-pairing tool (app/api/school/mentorship/route.ts POST)
 * so approved partnerships land in the same place and get the same
 * chat/idea-board/rename UI on /partnerships.
 */
export async function createPartnershipRoom(
  schoolId: string,
  participantIds: string[],
  groupName: string
): Promise<{ id: string }> {
  const uniqueIds = [...new Set(participantIds)];
  return prisma.conversation.create({
    data: {
      type: "MENTORSHIP",
      schoolId,
      communityName: groupName,
      participants: { create: uniqueIds.map((userId) => ({ userId })) },
    },
    select: { id: true },
  });
}

/**
 * Lazily finalizes PENDING partnership requests whose 48h window has
 * passed. No cron infra exists in this app, so this is called at the top
 * of every page/route that reads partnership data for a school.
 */
export async function finalizeExpiredPartnershipRequests(schoolId: string): Promise<void> {
  const expired = await prisma.partnershipRequest.findMany({
    where: { schoolId, status: "PENDING", expiresAt: { lte: new Date() } },
    include: { invites: true },
  });

  for (const request of expired) {
    const acceptedIds = request.invites.filter((i) => i.status === "ACCEPTED").map((i) => i.userId);
    let hasEligible = false;
    for (const id of acceptedIds) {
      if (await isEligiblePartner(id)) {
        hasEligible = true;
        break;
      }
    }
    await prisma.partnershipRequest.update({
      where: { id: request.id },
      data: {
        status: hasEligible ? "AWAITING_APPROVAL" : "EXPIRED_EMPTY",
        finalizedAt: new Date(),
      },
    });
  }
}
