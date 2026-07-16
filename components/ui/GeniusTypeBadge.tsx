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
      className={`genius-badge inline-flex items-center gap-1.5 rounded-full font-bold uppercase ${sizeClasses[size]} ${className}`}
      style={{
        backgroundColor: `${gt.color}18`,
        color: gt.color,
        border: `1px solid ${gt.color}40`,
        fontFamily: "var(--font-mono)",
        letterSpacing: "var(--tracking-hud, 0.18em)",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: gt.color, flexShrink: 0 }} />
      {showEmoji && <span style={{ fontFamily: "var(--font-body)", letterSpacing: "normal", textTransform: "none" }}>{gt.emoji}</span>}
      {gt.label}
    </span>
  );
}
