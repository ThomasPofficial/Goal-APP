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
      className={`inline-flex items-center font-medium rounded-sm border-l-2 ${
        size === "sm"
          ? "px-2 py-0.5 text-[11px]"
          : "px-2.5 py-1 text-xs"
      }`}
      style={{
        borderLeftColor: color,
        backgroundColor: `${color}14`,
        color: color,
      }}
    >
      {name}
    </span>
  );
}
