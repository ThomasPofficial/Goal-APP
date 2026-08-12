import { prisma } from "@/lib/prisma";

export const CAPABILITIES = [
  "roster:view",
  "roster:edit",
  "campaigns:view",
  "campaigns:edit",
  "staff:manage",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export const DEFAULT_TIERS: { name: string; permissions: Capability[] }[] = [
  {
    name: "Principal",
    permissions: ["roster:view", "roster:edit", "campaigns:view", "campaigns:edit", "staff:manage"],
  },
  {
    name: "Guidance Counselor",
    permissions: ["roster:view", "roster:edit", "campaigns:view"],
  },
  {
    name: "IT Manager",
    permissions: ["roster:view", "roster:edit", "staff:manage"],
  },
  {
    name: "Teacher",
    permissions: ["roster:view"],
  },
];

function parseCapabilityList(json: string | null | undefined): Capability[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is Capability => CAPABILITIES.includes(v));
  } catch {
    return [];
  }
}

export async function getOrCreateDefaultTiers(schoolId: string) {
  const existing = await prisma.facultyTier.findMany({
    where: { schoolId },
    orderBy: { createdAt: "asc" },
  });
  if (existing.length > 0) return existing;

  await prisma.facultyTier.createMany({
    data: DEFAULT_TIERS.map((t) => ({
      schoolId,
      name: t.name,
      permissions: JSON.stringify(t.permissions),
      isSystemDefault: true,
    })),
  });

  return prisma.facultyTier.findMany({
    where: { schoolId },
    orderBy: { createdAt: "asc" },
  });
}

export function computeEffectivePermissions(args: {
  tierPermissions: string | null | undefined;
  overrides: string | null | undefined;
}): Capability[] {
  const overrides = parseCapabilityList(args.overrides);
  if (!args.tierPermissions) {
    // No tier: overrides ARE the complete, custom permission set for this person.
    return overrides;
  }
  const tierPerms = parseCapabilityList(args.tierPermissions);
  return Array.from(new Set([...tierPerms, ...overrides]));
}

export function hasCapability(perms: Capability[], capability: Capability): boolean {
  return perms.includes(capability);
}
