import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import ProfileClient from './ProfileClient';

export default async function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const session = await auth();
  const { handle } = await params;

  const [profile, myProfile] = await Promise.all([
    prisma.profile.findUnique({
      where: { handle },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        handle: true,
        currentFocus: true,
        interests: true,
        grade: true,
        schoolName: true,
        isFirstGen: true,
        isHomeschooled: true,
        isInternational: true,
        userId: true,
        animalArchetypes: true,
        archetypeAnalysis: true,
        archetypeUpdatedAt: true,
        bio: true,
        staffTitle: true,
        industry: true,
        isAvailableToMentor: true,
        graduationYear: true,
        intendedCollege: true,
      },
    }),
    session?.user?.id
      ? prisma.profile.findUnique({
          where: { userId: session.user.id },
          select: { id: true, handle: true, displayName: true, avatarUrl: true, currentFocus: true, interests: true, grade: true, schoolName: true, isFirstGen: true, isHomeschooled: true, isInternational: true, animalArchetypes: true, archetypeAnalysis: true, archetypeUpdatedAt: true, bio: true, staffTitle: true, industry: true, isAvailableToMentor: true, graduationYear: true, intendedCollege: true },
        })
      : null,
  ]);

  if (!profile) notFound();

  const isOwnProfile = myProfile?.id === profile.id || (session?.user?.id && session.user.id === profile.userId);

  // Gate A: scholars see their own reviews on their own profile
  const ownReviews = isOwnProfile
    ? await prisma.orgReview.findMany({
        where: { profileId: profile.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          body: true,
          createdAt: true,
          org: { select: { name: true, logoLetter: true, logoBg: true, logoColor: true } },
          orgProject: { select: { title: true } },
        },
      })
    : [];

  return (
    <ProfileClient
      profile={{
        ...profile,
        archetypeUpdatedAt: profile.archetypeUpdatedAt?.toISOString() ?? null,
      }}
      isOwn={!!isOwnProfile}
      myProfile={myProfile ? { ...myProfile, archetypeUpdatedAt: myProfile.archetypeUpdatedAt?.toISOString() ?? null } : null}
      ownReviews={ownReviews.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
    />
  );
}
