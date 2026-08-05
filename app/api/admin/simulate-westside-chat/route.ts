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
    "just had a great call with my mentor about internship applications, highly recommend booking time with yours",
    "any alumni around willing to speak on the Spring Alumni Spotlight panel next month?",
    "loved reconnecting with fellow alumni at the networking mixer last week",
    "seniors — check the Alumni Network tab, a few of us are open to mentoring on resumes and essays",
    "so grateful for the alumni who came back to judge our science fair this year",
    "any alumni advice on navigating the first semester of college? feeling nervous",
    "shoutout to our alumni mentors who've been so responsive this month",
    "just posted about my internship experience, happy to chat with any current students",
    "excited to see so many alumni chip in for the scholarship fund this year",
    "reminder: the alumni-student mentorship pairing form closes Friday, sign up if you haven't",
    "grateful for the alumni panel today, learned a lot about picking a major",
    "any alumni working in tech want to do a Q&A for the CS club?",
    "just connected with my assigned mentor, already feels like a great match",
    "the alumni newsletter this month has some great career advice, worth a read",
    "who else is joining the alumni networking night on campus next week",
    "big thanks to the alumni who came back for career day, super helpful",
    "our mentor sent over some scholarship leads, sharing with the group",
    "if anyone wants an alumni referral for a summer internship, ask around here",
    "the alumni spotlight on this month's grad going into medicine was inspiring",
    "does anyone have a mentor in finance? mine's been amazing with interview prep",
    "alumni fundraiser update: we're close to hitting the scholarship goal, keep sharing!",
    "just scheduled my first 1:1 with my mentor, any tips for a good first conversation?",
    "so many alumni showed up for homecoming, it was great catching up",
    "our mentor group chat has been super helpful for college app questions",
    "any recent grads willing to talk about what freshman year is actually like",
    "the alumni-led workshop on personal statements was really useful",
    "shoutout to the mentor who helped me prep for my scholarship interview",
    "alumni are hosting a resume review session this Thursday, come by",
    "just got matched with a mentor in my intended major, feeling hopeful",
    "reminder to thank your mentor, they're volunteering their time for us",
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
