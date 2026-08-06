import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isWalledStudent } from "@/lib/accountGate";
import MentorshipClient from "./MentorshipClient";

export default async function MentorshipPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [walled, pending] = await Promise.all([
    isWalledStudent(session.user.id),
    prisma.connectionRequest.findMany({
      where: { toUserId: session.user.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Anyone who isn't a walled student still gets in if they have a mentorship
  // request waiting on them — otherwise there's nothing on this page for them.
  if (!walled && pending.length === 0) redirect("/dashboard");

  const incoming = await Promise.all(
    pending.map(async (r) => {
      const fromUser = await prisma.user.findUnique({
        where: { id: r.fromUserId },
        select: { id: true, name: true, profile: { select: { displayName: true, handle: true, avatarUrl: true } } },
      });
      return {
        id: r.id,
        message: r.message,
        createdAt: r.createdAt.toISOString(),
        fromUser: {
          id: r.fromUserId,
          displayName: fromUser?.profile?.displayName ?? fromUser?.name ?? "Someone",
          handle: fromUser?.profile?.handle ?? null,
          avatarUrl: fromUser?.profile?.avatarUrl ?? null,
        },
      };
    })
  );

  return <MentorshipClient myUserId={session.user.id} incomingRequests={incoming} />;
}
