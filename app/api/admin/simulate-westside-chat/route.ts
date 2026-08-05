import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Posts a burst of messages into Westside Academy's General community room,
// authored by a rotating cast of the seeded roster (see
// /api/admin/seed-westside-stress-test) — simulates ~180 accounts chatting
// at once to stress-test the community chat pipe.
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== "niv-reset-2026") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const count = Math.min(Math.max(Number(searchParams.get("count") ?? 120), 1), 400);

  const schoolUser = await prisma.user.findUnique({ where: { email: "school@nivarro.demo" } });
  if (!schoolUser) {
    return NextResponse.json(
      { error: "Westside Academy not seeded — run /api/admin/seed-westside-stress-test first" },
      { status: 404 }
    );
  }
  const schoolId = schoolUser.id;

  const room = await prisma.conversation.findFirst({
    where: { type: "COMMUNITY", schoolId, isPrivateRoom: false },
    select: { id: true },
  });
  if (!room) {
    return NextResponse.json(
      { error: "General room doesn't exist yet — run /api/admin/seed-westside-stress-test first" },
      { status: 404 }
    );
  }

  const roster = await prisma.conversationParticipant.findMany({
    where: { conversationId: room.id, userId: { not: schoolId } },
    select: { userId: true, user: { select: { name: true, email: true } } },
  });
  if (roster.length === 0) {
    return NextResponse.json({ error: "No roster members joined to General room" }, { status: 400 });
  }

  const MESSAGE_TEMPLATES = [
    "anyone else stressed about the calc test tomorrow",
    "does anyone have notes from AP Bio today, I was out sick",
    "the robotics club meeting got moved to Thursday btw",
    "who's going to the game Friday night",
    "just submitted my common app essay finally 🎉",
    "is the library open late tonight before finals",
    "shoutout to the debate team for winning regionals!!",
    "does anyone want to study for chem in the commons after school",
    "reminder: yearbook photos are this week, don't forget",
    "can someone explain the homework from period 3, I'm lost",
    "the cafeteria pizza today was actually fire",
    "who's running for student council this year",
    "college app season is rough, anyone else pulling all nighters",
    "our team's project demo is next week, we need more testers",
    "does anyone have an extra scientific calculator I can borrow",
    "the spring musical auditions are posted, good luck everyone",
    "is anyone else's wifi in the science wing down right now",
    "congrats to the swim team on making state finals",
    "can we get a study group going for the SAT in march",
    "the new mural in the art hallway looks incredible",
    "does anyone know if practice got cancelled for the rain",
    "just got my acceptance letter!! so relieved",
    "who else is doing the community service trip this weekend",
    "the counseling office is doing walk-in hours today at lunch",
    "anyone free to run lines for the play this weekend",
    "our club is doing a bake sale friday, come support!",
    "does the AP lit essay need a full outline or just notes",
    "good luck to everyone taking the ACT saturday",
    "is there a makeup day for the field trip we missed",
    "the new vending machine in the gym finally has snacks",
    "who's carpooling to the tournament saturday morning",
    "does anyone want to trade lunch periods with me next semester",
    "just finished my scholarship application, feels good",
    "the announcement about the spring break schedule is up",
    "can someone post the study guide for the history midterm",
    "props to the newspaper team for the article this week",
    "is anyone else doing the internship fair next tuesday",
    "the marching band sounded amazing at practice today",
    "does anyone have extra graph paper for stats class",
    "we need one more person for our science fair group",
  ];

  const chunk = <T,>(arr: T[], size: number) => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  const jobs = Array.from({ length: count }, () => {
    const sender = roster[Math.floor(Math.random() * roster.length)];
    const content = MESSAGE_TEMPLATES[Math.floor(Math.random() * MESSAGE_TEMPLATES.length)];
    return { senderId: sender.userId, content };
  });

  let posted = 0;
  const uniqueSenders = new Set<string>();
  for (const batch of chunk(jobs, 15)) {
    // Sequential per-batch to preserve realistic createdAt ordering while
    // still parallelizing across batches for throughput.
    for (const job of batch) {
      await prisma.message.create({ data: { conversationId: room.id, ...job } });
      uniqueSenders.add(job.senderId);
      posted++;
    }
  }

  await prisma.conversation.update({ where: { id: room.id }, data: { updatedAt: new Date() } });

  return NextResponse.json({
    ok: true,
    roomId: room.id,
    rosterSize: roster.length,
    posted,
    uniqueSendersUsed: uniqueSenders.size,
  });
}
