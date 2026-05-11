import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

async function verifyMember(userId: string, teamId: string) {
  const myProfile = await prisma.profile.findUnique({ where: { userId }, select: { id: true } });
  if (!myProfile) return null;
  const m = await prisma.teamMember.findFirst({ where: { teamId, profileId: myProfile.id } });
  return m ? myProfile : null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: teamId } = await params;
  const profile = await verifyMember(session.user.id, teamId);
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const cards = await prisma.noteboardCard.findMany({
    where: { teamId },
    orderBy: { order: "asc" },
  });
  return NextResponse.json({ cards });
}

const notePayload = z.object({ body: z.string().max(500), color: z.string(), reminderAt: z.string().nullable().optional() });
const taskPayload = z.object({ title: z.string().max(200), assigneeIds: z.array(z.string()), dueDate: z.string().nullable().optional(), status: z.enum(["todo","inprogress","done"]) });
const checklistPayload = z.object({ title: z.string().max(200), items: z.array(z.object({ id: z.string(), text: z.string(), checked: z.boolean() })) });

const createSchema = z.object({
  type: z.enum(["NOTE", "TASK", "CHECKLIST"]),
  payload: z.unknown(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: teamId } = await params;
  const profile = await verifyMember(session.user.id, teamId);
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const { type, payload } = parsed.data;
  let validPayload: unknown;
  if (type === "NOTE") validPayload = notePayload.parse(payload);
  else if (type === "TASK") validPayload = taskPayload.parse(payload);
  else validPayload = checklistPayload.parse(payload);

  const maxOrder = await prisma.noteboardCard.aggregate({ where: { teamId }, _max: { order: true } });

  const card = await prisma.noteboardCard.create({
    data: {
      teamId,
      type,
      payload: JSON.stringify(validPayload),
      creatorId: profile.id,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  return NextResponse.json({ card });
}

const reorderSchema = z.object({ orderedIds: z.array(z.string()) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: teamId } = await params;
  const profile = await verifyMember(session.user.id, teamId);
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  await prisma.$transaction(
    parsed.data.orderedIds.map((cardId, index) =>
      prisma.noteboardCard.updateMany({ where: { id: cardId, teamId }, data: { order: index } })
    )
  );

  return NextResponse.json({ ok: true });
}
