import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import TraitBadge from "@/components/profile/TraitBadge";
import type { TraitCategory } from "@/data/traits";
import { getInitials } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function PersonProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const session = await auth();

  const profile = await prisma.profile.findUnique({
    where: { userId },
    include: {
      traitLinks: {
        orderBy: { order: "asc" },
        include: { trait: true },
      },
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!profile) notFound();

  const initials = getInitials(profile.displayName);
  const isOwnProfile = session?.user?.id === userId;

  return (
    <div className="max-w-2xl">
      <Link
        href="/peers"
        className="inline-flex items-center gap-1.5 text-sm text-[#9898a8] hover:text-[#e8e8ec] mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Peers
      </Link>

      <div className="bg-[#16161a] border border-[#2a2a33] rounded-xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-[#2a2a33]">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full flex-shrink-0 flex items-center justify-center text-lg font-bold bg-[#c9a84c20] text-[#c9a84c] ring-2 ring-[#c9a84c30]">
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatarUrl}
                  alt={profile.displayName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold text-[#e8e8ec]">
                {profile.displayName}
              </h1>
              {profile.headline && (
                <p className="text-sm text-[#9898a8] mt-1">{profile.headline}</p>
              )}
              {!isOwnProfile && (
                <div className="flex gap-2 mt-3">
                  <Link
                    href={`/messages?userId=${userId}`}
                    className="text-xs font-medium px-3 py-1.5 bg-[#c9a84c] hover:bg-[#e3c06a] text-[#0f0f11] rounded-md transition-colors"
                  >
                    Message
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Traits */}
        {profile.traitLinks.length > 0 && (
          <div className="p-6 border-b border-[#2a2a33]">
            <h2 className="text-xs font-semibold text-[#5a5a6a] uppercase tracking-wider mb-3">
              Traits
            </h2>
            <div className="flex flex-wrap gap-2">
              {profile.traitLinks.map((link) => (
                <TraitBadge
                  key={link.id}
                  name={link.trait.name}
                  category={link.trait.category as TraitCategory}
                  size="md"
                />
              ))}
            </div>
          </div>
        )}

        {/* Strength summary */}
        {profile.strengthSummary && (
          <div className="p-6 border-b border-[#2a2a33]">
            <h2 className="text-xs font-semibold text-[#5a5a6a] uppercase tracking-wider mb-3">
              Strengths
            </h2>
            <p className="text-sm text-[#9898a8] leading-relaxed">
              {profile.strengthSummary}
            </p>
          </div>
        )}

        {/* Bio */}
        {profile.bio && (
          <div className="p-6">
            <h2 className="text-xs font-semibold text-[#5a5a6a] uppercase tracking-wider mb-3">
              About
            </h2>
            <p className="text-sm text-[#9898a8] leading-relaxed">{profile.bio}</p>
          </div>
        )}
      </div>
    </div>
  );
}
