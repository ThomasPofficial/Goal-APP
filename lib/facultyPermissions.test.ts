import { describe, it, expect } from "vitest";
import { computeEffectivePermissions, capabilityState, toggleCapability } from "./facultyPermissions";

describe("computeEffectivePermissions", () => {
  it("returns tier permissions plus an override", () => {
    const result = computeEffectivePermissions({
      tierPermissions: JSON.stringify(["roster:view", "roster:edit"]),
      overrides: JSON.stringify(["campaigns:view"]),
      revocations: JSON.stringify([]),
    });
    expect(result.sort()).toEqual(["campaigns:view", "roster:edit", "roster:view"].sort());
  });

  it("subtracts a revoked tier permission", () => {
    const result = computeEffectivePermissions({
      tierPermissions: JSON.stringify(["roster:view", "roster:edit"]),
      overrides: JSON.stringify([]),
      revocations: JSON.stringify(["roster:edit"]),
    });
    expect(result).toEqual(["roster:view"]);
  });

  it("lets a revocation win even when the same capability is also an override", () => {
    const result = computeEffectivePermissions({
      tierPermissions: JSON.stringify(["roster:view"]),
      overrides: JSON.stringify(["staff:manage"]),
      revocations: JSON.stringify(["staff:manage"]),
    });
    expect(result).not.toContain("staff:manage");
  });

  it("treats overrides as the complete set and ignores revocations when there is no tier (Custom)", () => {
    const result = computeEffectivePermissions({
      tierPermissions: null,
      overrides: JSON.stringify(["roster:view"]),
      revocations: JSON.stringify(["roster:view"]),
    });
    expect(result).toEqual(["roster:view"]);
  });

  it("returns an empty array for malformed JSON instead of throwing", () => {
    const result = computeEffectivePermissions({ tierPermissions: "not json", overrides: "[]", revocations: "[]" });
    expect(result).toEqual([]);
  });

  it("ignores unknown capability strings", () => {
    const result = computeEffectivePermissions({
      tierPermissions: JSON.stringify(["roster:view", "not-a-real-capability"]),
      overrides: JSON.stringify([]),
      revocations: JSON.stringify([]),
    });
    expect(result).toEqual(["roster:view"]);
  });
});

describe("capabilityState", () => {
  it("is inherited when granted by the tier and not revoked", () => {
    expect(capabilityState("roster:view", ["roster:view"], [], [])).toBe("inherited");
  });

  it("is off when revoked even though the tier grants it", () => {
    expect(capabilityState("roster:view", ["roster:view"], [], ["roster:view"])).toBe("off");
  });

  it("is granted when present in overrides regardless of the tier", () => {
    expect(capabilityState("staff:manage", [], ["staff:manage"], [])).toBe("granted");
  });

  it("is off when absent from both the tier and overrides", () => {
    expect(capabilityState("staff:manage", ["roster:view"], [], [])).toBe("off");
  });
});

describe("toggleCapability", () => {
  it("revokes an inherited capability when toggled off", () => {
    expect(toggleCapability("roster:view", ["roster:view"], [], [])).toEqual({
      overrides: [],
      revocations: ["roster:view"],
    });
  });

  it("removes the override when toggling off a granted (non-tier) capability", () => {
    expect(toggleCapability("staff:manage", [], ["staff:manage"], [])).toEqual({
      overrides: [],
      revocations: [],
    });
  });

  it("un-revokes when toggling on a capability that was revoked but tier-granted", () => {
    expect(toggleCapability("roster:view", ["roster:view"], [], ["roster:view"])).toEqual({
      overrides: [],
      revocations: [],
    });
  });

  it("adds an override when toggling on a capability the tier doesn't grant", () => {
    expect(toggleCapability("staff:manage", ["roster:view"], [], [])).toEqual({
      overrides: ["staff:manage"],
      revocations: [],
    });
  });
});
