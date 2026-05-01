import Link from "next/link";
import TraitBadge from "./TraitBadge";
import { getInitials } from "@/lib/utils";
import { GENIUS_TYPE_INFO } from "@/data/traits";
import type { TraitCategory, GeniusType } from "@/data/traits";

interface SkillCardTrait {
  name: string;
  category: TraitCategory;
}

interface PeerTrait extends SkillCardTrait {
  endorseCount: number; // how many teammates endorsed this trait
}

export interface SkillCardData {
  userId: string;
  displayName: string;
  headline?: string | null;
  avatarUrl?: string | null;
  strengthSummary?: string | null;
  geniusType?: GeniusType | null;
  // Self-selected traits (user chose these)
  selfTraits: SkillCardTrait[];
  // Peer-endorsed traits (teammates confirmed these after a project)
  peerTraits?: PeerTrait[];
}

interface SkillCardProps {
  data: SkillCardData;
  showActions?: boolean;
  onAddToProject?: (userId: string) => void;
  compact?: boolean; // smaller card for dashboard hero
}

export default function SkillCard({
  data,
  showActions = false,
  onAddToProject,
  compact = false,
}: SkillCardProps) {
  const initials = getInitials(data.displayName);
  const genius = data.geniusType ? GENIUS_TYPE_INFO[data.geniusType] : null;
  const hasPeerTraits = data.peerTraits && data.peerTraits.length > 0;

  return (
    <div
      className={`group bg-[#0d0d0e] border border-[#1c1c20] rounded-[10px] flex flex-col gap-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.5),0_0_0_1px_rgba(201,168,76,0.15)] hover:border-[#28282e] transition-all duration-200 ${
        compact ? "p-4" : "p-5"
      }`}
    >
      {/* Header: Avatar + Name + Genius type */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          {data.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.avatarUrl}
              alt={data.displayName}
              className={`rounded-full object-cover ring-1 ring-[#c9a84c30] ${
                compact ? "w-9 h-9" : "w-12 h-12"
              }`}
            />
          ) : (
            <div
              className={`rounded-full flex items-center justify-center font-bold bg-[#c9a84c20] text-[#c9a84c] ring-1 ring-[#c9a84c30] ${
                compact ? "w-9 h-9 text-xs" : "w-12 h-12 text-sm"
              }`}
            >
              {initials}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3
            className={`font-semibold text-[#eaeaea] truncate ${
              compact ? "text-sm" : "text-sm"
            }`}
          >
            {data.displayName}
          </h3>
          {data.headline && (
            <p className="text-xs text-[#909098] truncate mt-0.5">
              {data.headline}
            </p>
          )}
          {genius && (
            <div
              className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
              style={{
                backgroundColor: `${genius.color}18`,
                color: genius.color,
              }}
            >
              {genius.icon} {genius.label}
            </div>
          )}
        </div>
      </div>

      {/* Self-selected traits */}
      {data.selfTraits.length > 0 && (
        <div>
          {hasPeerTraits && (
            <div className="text-[9px] text-[#58586a] uppercase tracking-wider mb-1.5 font-medium">
              Self-Selected
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {data.selfTraits.slice(0, 5).map((trait) => (
              <TraitBadge
                key={trait.name}
                name={trait.name}
                category={trait.category}
                size="sm"
              />
            ))}
          </div>
        </div>
      )}

      {/* Peer-endorsed traits (shown only when they exist) */}
      {hasPeerTraits && (
        <div className="border-t border-[#1c1c20] pt-3">
          <div className="text-[9px] text-[#58586a] uppercase tracking-wider mb-1.5 font-medium flex items-center gap-1">
            <span className="text-[#4ADE80]">✓</span> Peer-Endorsed
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.peerTraits!.slice(0, 5).map((trait) => (
              <span key={trait.name} className="relative inline-flex items-center gap-1">
                <TraitBadge
                  name={trait.name}
                  category={trait.category}
                  size="sm"
                />
                {trait.endorseCount > 1 && (
                  <span className="text-[9px] text-[#58586a]">
                    ×{trait.endorseCount}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Strength summary (not in compact mode) */}
      {!compact && data.strengthSummary && (
        <p className="text-xs text-[#909098] leading-relaxed line-clamp-3 border-t border-[#1c1c20] pt-3">
          {data.strengthSummary}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-auto pt-0.5">
        <Link
          href={`/people/${data.userId}`}
          className="flex-1 text-center text-xs font-medium text-[#909098] hover:text-[#eaeaea] border border-[#1c1c20] hover:border-[#28282e] rounded-md py-1.5 transition-colors"
        >
          View
        </Link>
        {showActions && onAddToProject && (
          <button
            onClick={() => onAddToProject(data.userId)}
            className="flex-1 text-xs font-medium text-[#c9a84c] hover:text-[#e3c06a] border border-[#c9a84c30] hover:border-[#c9a84c60] rounded-md py-1.5 transition-colors"
          >
            Add to project
          </button>
        )}
      </div>
    </div>
  );
}
