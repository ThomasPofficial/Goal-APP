import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(_req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;

  const profile = await prisma.profile.findUnique({
    where: { handle },
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      handle: true,
      geniusType: true,
      secondaryGeniusType: true,
      currentFocus: true,
      interests: true,
      grade: true,
      schoolName: true,
      isFirstGen: true,
      isHomeschooled: true,
      isInternational: true,
    },
  });

  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ profile });
}
