import { TRAIT_CATEGORY_COLORS } from "@/data/traits";
import type { TraitCategory } from "@/data/traits";

interface TraitBadgeProps {
  name: string;
  category: TraitCategory;
  size?: "sm" | "md";
}

export default function TraitBadge({
  name,
  category,
  size = "sm",
}: TraitBadgeProps) {
  const color = TRAIT_CATEGORY_COLORS[category];

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium border ${
        size === "sm"
          ? "gap-1.5 px-2.5 py-0.5 text-[11px]"
          : "gap-[7px] px-3 py-1 text-xs"
      }`}
      style={{
        borderColor: "var(--border-md)",
        backgroundColor: "var(--surface2)",
        color: "var(--text2)",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
      {name}
    </span>
  );
}
