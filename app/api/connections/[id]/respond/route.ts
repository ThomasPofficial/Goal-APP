import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

type Params = Promise<{ id: string }>;

const respondSchema = z.object({ action: z.enum(["accept", "decline"]) });

// PATCH — the request's target accepts or declines
export async function PATCH(req: Request, { params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = respondSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const connectionRequest = await prisma.connectionRequest.findUnique({ where: { id } });
  if (!connectionRequest) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (connectionRequest.toUserId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (connectionRequest.status !== "PENDING") {
    return NextResponse.json({ error: "Already responded to" }, { status: 409 });
  }

  const updated = await prisma.connectionRequest.update({
    where: { id },
    data: {
      status: parsed.data.action === "accept" ? "ACCEPTED" : "DECLINED",
      respondedAt: new Date(),
    },
  });

  return NextResponse.json({ request: updated });
}
