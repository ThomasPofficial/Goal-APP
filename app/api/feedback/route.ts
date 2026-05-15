import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getResendClient } from "@/lib/resend";

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

  const resend = getResendClient();

  try {
    await resend.emails.send({
      from: "Nivarro Feedback <feedback@nivarro.co>",
      to: "team.nivarro@gmail.com",
      subject: "New Feedback from Nivarro",
      html: `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2 style="color: #4A80F0;">New Feedback</h2>
          <p><strong>From:</strong> ${session.user.email ?? session.user.id}</p>
          <hr style="border-color: #2a2a33;" />
          <p style="white-space: pre-wrap; font-size: 15px; line-height: 1.6;">${parsed.data.message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("[FEEDBACK] Email send failed:", err);
    // Still return ok — don't fail the user if email errors
  }

  return NextResponse.json({ ok: true });
}
