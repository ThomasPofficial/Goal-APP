import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ConnectionsClient from "./ConnectionsClient";

async function userSummary(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, profile: { select: { displayName: true, avatarUrl: true } } },
  });
  return {
    userId,
    displayName: user?.profile?.displayName ?? user?.name ?? "Unknown",
    avatarUrl: user?.profile?.avatarUrl ?? null,
  };
}

export default async function SchoolConnectionsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "SCHOOL") redirect("/dashboard");

  const schoolId = session.user.id;

  const [queue, history] = await Promise.all([
    prisma.connectionRequest.findMany({
      where: { schoolId, status: "ACCEPTED", roomId: null },
      orderBy: { respondedAt: "asc" },
    }),
    prisma.connectionRequest.findMany({
      where: { schoolId, roomId: { not: null } },
      orderBy: { respondedAt: "desc" },
      take: 50,
    }),
  ]);

  const formatRow = async (r: (typeof queue)[number]) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    respondedAt: r.respondedAt?.toISOString() ?? null,
    roomId: r.roomId,
    fromUser: await userSummary(r.fromUserId),
    toUser: await userSummary(r.toUserId),
  });

  const [formattedQueue, formattedHistory] = await Promise.all([
    Promise.all(queue.map(formatRow)),
    Promise.all(history.map(formatRow)),
  ]);

  return <ConnectionsClient queue={formattedQueue} history={formattedHistory} />;
}
