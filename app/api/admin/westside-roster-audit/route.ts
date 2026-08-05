import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Diagnostic endpoint: exact headcounts for the Westside Academy stress-test
// roster, plus a check of which "Thomas"-named accounts are (or aren't)
// participants in the General room, so two-way delivery can be verified.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== "niv-reset-2026") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const schoolUser = await prisma.user.findUnique({ where: { email: "school@nivarro.demo" } });
  if (!schoolUser) return NextResponse.json({ error: "Westside Academy not seeded yet" }, { status: 404 });
  const schoolId = schoolUser.id;

  const room = await prisma.conversation.findFirst({
    where: { type: "COMMUNITY", schoolId, isPrivateRoom: false },
    select: { id: true },
  });

  const [totalLinkedProfiles, staffCount, mentorCount, plainStudentCount, roomParticipants, messageCount] =
    await Promise.all([
      prisma.profile.count({ where: { schoolId } }),
      prisma.profile.count({ where: { schoolId, staffTitle: { not: null } } }),
      prisma.profile.count({ where: { schoolId, isAvailableToMentor: true } }),
      prisma.profile.count({ where: { schoolId, staffTitle: null, isAvailableToMentor: false } }),
      room
        ? prisma.conversationParticipant.count({ where: { conversationId: room.id } })
        : Promise.resolve(0),
      room ? prisma.message.count({ where: { conversationId: room.id } }) : Promise.resolve(0),
    ]);

  // Find any "Thomas"-named real accounts and check their school link + room membership
  const thomasUsers = await prisma.user.findMany({
    where: { OR: [{ name: { contains: "Thomas" } }, { email: { contains: "piacentine" } }, { email: { contains: "argentini" } }] },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      profile: { select: { schoolId: true, displayName: true } },
    },
  });

  const thomasAccounts = await Promise.all(
    thomasUsers.map(async (u) => {
      const inRoom = room
        ? !!(await prisma.conversationParticipant.findUnique({
            where: { conversationId_userId: { conversationId: room.id, userId: u.id } },
          }))
        : false;
      return {
        name: u.name,
        email: u.email,
        role: u.role,
        profileSchoolId: u.profile?.schoolId ?? null,
        matchesWestsideSchoolId: u.profile?.schoolId === schoolId,
        isParticipantInGeneralRoom: inRoom,
      };
    })
  );

  return NextResponse.json({
    westsideSchoolId: schoolId,
    generalRoomId: room?.id ?? null,
    counts: {
      totalProfilesLinkedToSchool: totalLinkedProfiles,
      staff: staffCount,
      mentors: mentorCount,
      plainStudents: plainStudentCount,
      generalRoomParticipants: roomParticipants,
      messagesInGeneralRoom: messageCount,
    },
    thomasAccounts,
  });
}
