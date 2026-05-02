import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({ message: z.string().min(1).max(1000) });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid" }, { status: 400 });
  }

  // In v1 just log it — no feedback model in schema yet
  console.log(`[FEEDBACK] user=${session.user.id} msg=${parsed.data.message}`);

  return NextResponse.json({ ok: true });
}
