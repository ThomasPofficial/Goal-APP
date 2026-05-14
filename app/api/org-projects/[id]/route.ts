import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const project = await prisma.orgProject.findUnique({
    where: { id },
    include: {
      org: { select: { id: true, name: true, accentColor: true } },
      teamApplications: {
        include: {
          team: {
            include: {
              members: {
                include: {
                  profile: { select: { id: true, displayName: true, avatarUrl: true, geniusType: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ project });
}
