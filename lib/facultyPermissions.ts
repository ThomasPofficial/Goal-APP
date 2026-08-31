export const CAPABILITIES = [
  "roster:view",
  "roster:edit",
  "campaigns:view",
  "campaigns:edit",
  "mentorship:view",
  "mentorship:edit",
  "partnerships:view",
  "partnerships:edit",
  "community:manage",
  "staff:manage",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export const DEFAULT_TIERS: { name: string; permissions: Capability[] }[] = [
  {
    name: "Principal",
    permissions: [
      "roster:view",
      "roster:edit",
      "campaigns:view",
      "campaigns:edit",
      "mentorship:view",
      "mentorship:edit",
      "partnerships:view",
      "partnerships:edit",
      "community:manage",
      "staff:manage",
    ],
  },
  {
    name: "Guidance Counselor",
    permissions: ["roster:view", "roster:edit", "campaigns:view", "mentorship:view", "mentorship:edit", "partnerships:view"],
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
    return parsed.filter((v): v is Capability => (CAPABILITIES as readonly string[]).includes(v));
  } catch {
    return [];
  }
}

export function computeEffectivePermissions(args: {
  tierPermissions: string | null | undefined;
  overrides: string | null | undefined;
  revocations: string | null | undefined;
}): Capability[] {
  const overrides = parseCapabilityList(args.overrides);
  if (!args.tierPermissions) {
    // No tier: overrides ARE the complete, custom permission set for this person.
    // Revocations have nothing to subtract from in this state.
    return overrides;
  }
  const tierPerms = parseCapabilityList(args.tierPermissions);
  const revocations = parseCapabilityList(args.revocations);
  const granted = new Set<Capability>([...tierPerms, ...overrides]);
  for (const r of revocations) granted.delete(r);
  return Array.from(granted);
}

export function hasCapability(perms: Capability[], capability: Capability): boolean {
  return perms.includes(capability);
}

export type CapabilityState = "inherited" | "granted" | "off";

// UI helper: given a tiered person's tier permissions + their personal
// overrides/revocations, classify one capability's display state.
// "inherited" = comes from the tier (dimmed checkbox in the UI, click to revoke).
// "granted" = a personal override beyond the tier (highlighted, click to remove).
// "off" = not granted at all (click to add, either as an override or by un-revoking).
export function capabilityState(
  cap: Capability,
  tierPermissions: Capability[],
  overrides: Capability[],
  revocations: Capability[]
): CapabilityState {
  if (overrides.includes(cap)) return "granted";
  if (tierPermissions.includes(cap) && !revocations.includes(cap)) return "inherited";
  return "off";
}

// UI helper: click-to-toggle transition for a tiered person's capability cell.
// Only meaningful when the person has a tier — Custom (untiered) people toggle
// their overrides array directly instead (overrides ARE the whole set there).
export function toggleCapability(
  cap: Capability,
  tierPermissions: Capability[],
  overrides: Capability[],
  revocations: Capability[]
): { overrides: Capability[]; revocations: Capability[] } {
  const state = capabilityState(cap, tierPermissions, overrides, revocations);
  if (state === "granted") {
    return { overrides: overrides.filter((c) => c !== cap), revocations };
  }
  if (state === "inherited") {
    return { overrides, revocations: [...revocations, cap] };
  }
  // state === "off"
  if (tierPermissions.includes(cap)) {
    // Was revoked — un-revoke to fall back to inherited.
    return { overrides, revocations: revocations.filter((c) => c !== cap) };
  }
  return { overrides: [...overrides, cap], revocations };
}
