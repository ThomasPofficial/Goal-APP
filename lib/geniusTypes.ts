export type GeniusTypeKey = "DYNAMO" | "BLAZE" | "TEMPO" | "STEEL";

export const GENIUS_TYPES = {
  DYNAMO: {
    key: "DYNAMO" as const,
    label: "Dynamo",
    emoji: "⚡",
    color: "#F59E0B",
    accent: "amber",
    tagline: "The Visionary Builder",
    description:
      "You see possibilities where others see problems. Driven by big ideas and relentless energy, you turn concepts into reality at full speed.",
    tension: "You move fast — slow processes and over-analysis can be your kryptonite.",
    affinityInterests: ["entrepreneurship", "innovation", "startups", "leadership"],
    tailwindText: "text-amber-500",
    tailwindBg: "bg-amber-500/10",
    tailwindBorder: "border-amber-500/30",
  },
  BLAZE: {
    key: "BLAZE" as const,
    label: "Blaze",
    emoji: "🔥",
    color: "#EF4444",
    accent: "red",
    tagline: "The Bold Connector",
    description:
      "You thrive in the spotlight and energize every room you enter. People follow your lead because your passion is contagious.",
    tension: "You crave action — routine tasks and solitude can drain your fire.",
    affinityInterests: ["public speaking", "advocacy", "performing arts", "community organizing"],
    tailwindText: "text-red-500",
    tailwindBg: "bg-red-500/10",
    tailwindBorder: "border-red-500/30",
  },
  TEMPO: {
    key: "TEMPO" as const,
    label: "Tempo",
    emoji: "🎯",
    color: "#10B981",
    accent: "emerald",
    tagline: "The Steady Strategist",
    description:
      "You are the calm in the storm. Methodical and reliable, you build sustainable progress one deliberate step at a time.",
    tension: "You value stability — rapid change and ambiguity can slow your momentum.",
    affinityInterests: ["project management", "research", "journalism", "education"],
    tailwindText: "text-emerald-500",
    tailwindBg: "bg-emerald-500/10",
    tailwindBorder: "border-emerald-500/30",
  },
  STEEL: {
    key: "STEEL" as const,
    label: "Steel",
    emoji: "🛡️",
    color: "#6366F1",
    accent: "indigo",
    tagline: "The Deep Thinker",
    description:
      "You go deep where others go wide. Your precision and integrity make you the person everyone trusts to get it exactly right.",
    tension: "You seek perfection — good enough and public pressure can feel like sandpaper.",
    affinityInterests: ["engineering", "law", "philosophy", "data science"],
    tailwindText: "text-indigo-500",
    tailwindBg: "bg-indigo-500/10",
    tailwindBorder: "border-indigo-500/30",
  },
} as const;
