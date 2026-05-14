import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import NotificationsClient from "./NotificationsClient";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const myProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  const requests = myProfile
    ? await prisma.recruitmentRequest.findMany({
        where: { toProfileId: myProfile.id },
        include: {
          orgProject: {
            select: {
              id: true,
              title: true,
              orgId: true,
              org: { select: { id: true, name: true } },
            },
          },
          fromProfile: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
              geniusType: true,
              handle: true,
            },
          },
          team: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <NotificationsClient
      requests={requests.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        fromProfile: {
          ...r.fromProfile,
          geniusType: r.fromProfile.geniusType as string | null,
        },
      }))}
    />
  );
}
