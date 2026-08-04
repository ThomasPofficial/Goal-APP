"use client";

import { useState } from "react";
import { format } from "date-fns";

const ORG_TYPES = [
  { value: "NONPROFIT", label: "Non-profit / Volunteer", note: "Never pays" },
  { value: "PAY_LATER", label: "Company (pay later)", note: "Free now, pays when we scale" },
  { value: "COLLEGE", label: "College / University", note: "Academic opportunity" },
];

interface OrgRow {
  id: string;
  name: string;
  category: string;
  orgType: string | null;
  verified: boolean;
  createdAt: string;
  _count: { projects: number; teams: number };
}

export default function OrgCategoriesClient({ orgs: initial }: { orgs: OrgRow[] }) {
  const [orgs, setOrgs] = useState(initial);
  const [saving, setSaving] = useState<string | null>(null);

  async function update(id: string, patch: { orgType?: string | null; verified?: boolean }) {
    setSaving(id);
    await fetch(`/api/admin/org-meta/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setOrgs((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    setSaving(null);
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--text)" }}>Org Classification</h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>Private · admin only</p>

      <div className="space-y-2">
        {orgs.map((org) => (
          <div
            key={org.id}
            className="flex items-center gap-4 px-4 py-3 rounded-lg"
            style={{ background: "var(--surface)", border: "1px solid var(--border-md)" }}
          >
            {/* Verified toggle */}
            <button
              onClick={() => update(org.id, { verified: !org.verified })}
              disabled={saving === org.id}
              title={org.verified ? "Verified â€” click to unverify" : "Unverified â€” click to verify"}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="7" fill={org.verified ? "var(--amber)" : "var(--surface3)"} />
                <path d="M4 7l2 2 4-4" stroke={org.verified ? "#fff" : "var(--muted)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* Name + meta */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{org.name}</p>
              <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                {org.category} Â· {org._count.projects} project{org._count.projects !== 1 ? "s" : ""} Â· {org._count.teams} team{org._count.teams !== 1 ? "s" : ""} Â· joined {format(new Date(org.createdAt), "MMM d yyyy")}
              </p>
            </div>

            {/* Org type selector */}
            <select
              value={org.orgType ?? ""}
              onChange={(e) => update(org.id, { orgType: e.target.value || null })}
              disabled={saving === org.id}
              className="text-xs px-2 py-1 rounded"
              style={{ background: "var(--surface2)", border: "1px solid var(--border-md)", color: "var(--text2)" }}
            >
              <option value="">â€” unclassified â€”</option>
              {ORG_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <p className="text-xs mt-6" style={{ color: "var(--muted)" }}>
        NONPROFIT = never pays Â· PAY_LATER = free now, charged when Nivarro monetizes Â· COLLEGE = academic / university program
      </p>
    </div>
  );
}

