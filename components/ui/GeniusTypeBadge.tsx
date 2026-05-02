import { GENIUS_TYPES, type GeniusTypeKey } from "@/lib/geniusTypes";

interface GeniusTypeBadgeProps {
  geniusType?: GeniusTypeKey | null | undefined;
  type?: GeniusTypeKey | null | undefined;
  size?: "sm" | "md" | "lg";
  showEmoji?: boolean;
  className?: string;
}

export default function GeniusTypeBadge({ geniusType, type, size = "md", showEmoji = true, className = "" }: GeniusTypeBadgeProps) {
  const resolved = type ?? geniusType;
  if (!resolved) return null;
  const geniusType_ = resolved;

  const gt = GENIUS_TYPES[geniusType_];

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${sizeClasses[size]} ${className}`}
      style={{ backgroundColor: `${gt.color}22`, color: gt.color, border: `1px solid ${gt.color}55` }}
    >
      {showEmoji && <span>{gt.emoji}</span>}
      {gt.label}
    </span>
  );
}
