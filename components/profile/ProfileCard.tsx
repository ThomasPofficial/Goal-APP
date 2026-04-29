import Link from "next/link";
import TraitBadge from "./TraitBadge";
import { getInitials } from "@/lib/utils";
import type { TraitCategory } from "@/data/traits";

interface ProfileCardTrait {
  name: string;
  category: TraitCategory;
}

export interface ProfileCardData {
  userId: string;
  displayName: string;
  headline?: string | null;
  avatarUrl?: string | null;
  strengthSummary?: string | null;
  traits: ProfileCardTrait[];
}

interface ProfileCardProps {
  profile: ProfileCardData;
  showActions?: boolean;
  onAddToTeam?: (userId: string) => void;
}

export default function ProfileCard({
  profile,
  showActions = false,
  onAddToTeam,
}: ProfileCardProps) {
  const initials = getInitials(profile.displayName);

  return (
    <div className="group bg-[#0d0d0e] border border-[#1c1c20] rounded-[10px] p-5 flex flex-col gap-4 shadow-[0_1px_3px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.5),0_0_0_1px_rgba(201,168,76,0.15)] hover:border-[#28282e] transition-all duration-200">
      {/* Header: Avatar + Name */}
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold bg-[#c9a84c20] text-[#c9a84c] ring-1 ring-[#c9a84c30]">
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
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-[#eaeaea] text-sm truncate">
            {profile.displayName}
          </h3>
          {profile.headline && (
            <p className="text-xs text-[#909098] truncate mt-0.5">
              {profile.headline}
            </p>
          )}
        </div>
      </div>

      {/* Traits */}
      {profile.traits.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {profile.traits.slice(0, 5).map((trait) => (
            <TraitBadge
              key={trait.name}
              name={trait.name}
              category={trait.category}
              size="sm"
            />
          ))}
        </div>
      )}

      {/* Strength summary */}
      {profile.strengthSummary && (
        <p className="text-xs text-[#909098] leading-relaxed line-clamp-3">
          {profile.strengthSummary}
        </p>
      )}

      {/* Footer actions */}
      <div className="flex items-center gap-2 mt-auto pt-1">
        <Link
          href={`/people/${profile.userId}`}
          className="flex-1 text-center text-xs font-medium text-[#909098] hover:text-[#eaeaea] border border-[#1c1c20] hover:border-[#28282e] rounded-md py-1.5 transition-colors"
        >
          View profile
        </Link>
        {showActions && onAddToTeam && (
          <button
            onClick={() => onAddToTeam(profile.userId)}
            className="flex-1 text-xs font-medium text-[#c9a84c] hover:text-[#e3c06a] border border-[#c9a84c30] hover:border-[#c9a84c60] rounded-md py-1.5 transition-colors"
          >
            Add to team
          </button>
        )}
      </div>
    </div>
  );
}
