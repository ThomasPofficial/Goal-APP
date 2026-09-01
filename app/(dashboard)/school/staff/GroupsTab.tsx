"use client";

import { useState } from "react";
import { CAPABILITIES, type Capability } from "@/lib/facultyPermissions";
import type { Group } from "./PermissionsClient";
import { inputStyle, sectionHeadingStyle, sectionCardStyle, primaryButtonStyle, capabilityLabel } from "./styles";

interface Props {
  groups: Group[];
  onChanged: () => void;
}

export default function GroupsTab({ groups, onChanged }: Props) {
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleCell(group: Group, cap: Capability) {
    setError(null);
    const next = group.permissions.includes(cap) ? group.permissions.filter((c) => c !== cap) : [...group.permissions, cap];
    try {
      const res = await fetch(`/api/school/staff/tiers/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: next }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Failed to update permission.");
        return;
      }
      onChanged();
    } catch {
      setError("Network error. Please try again.");
    }
  }

  async function rename(group: Group, name: string) {
    if (!name.trim() || name === group.name) return;
    setError(null);
    try {
      const res = await fetch(`/api/school/staff/tiers/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Failed to rename group.");
        return;
      }
      onChanged();
    } catch {
      setError("Network error. Please try again.");
    }
  }

  async function addGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/school/staff/tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), permissions: [] }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Failed to add group.");
        return;
      }
      setNewName("");
      onChanged();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  async function deleteGroup(id: string) {
    if (!window.confirm("Delete this group? People on it keep their personal permissions but lose the group's.")) return;
    setError(null);
    try {
      const res = await fetch(`/api/school/staff/tiers/${id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Failed to delete group.");
        return;
      }
      onChanged();
    } catch {
      setError("Network error. Please try again.");
    }
  }

  return (
    <section style={sectionCardStyle}>
      <h2 style={sectionHeadingStyle}>Groups</h2>
      {error && <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 760 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "6px 8px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>Group</th>
              {CAPABILITIES.map((cap) => (
                <th key={cap} style={{ padding: "6px 8px", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", whiteSpace: "nowrap" }}>
                  {capabilityLabel(cap)}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "6px 8px" }}>
                  <input defaultValue={g.name} onBlur={(e) => rename(g, e.target.value)} style={{ ...inputStyle, minWidth: 160, fontWeight: 700 }} />
                </td>
                {CAPABILITIES.map((cap) => (
                  <td key={cap} style={{ textAlign: "center", padding: "6px 8px" }}>
                    <input
                      type="checkbox"
                      checked={g.permissions.includes(cap)}
                      onChange={() => toggleCell(g, cap)}
                      style={{ accentColor: "var(--amber)", cursor: "pointer" }}
                    />
                  </td>
                ))}
                <td style={{ padding: "6px 8px" }}>
                  {!g.isSystemDefault && (
                    <button onClick={() => deleteGroup(g.id)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 11 }}>
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={addGroup} style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <input placeholder="New group name" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ ...inputStyle, flex: 1, maxWidth: 260 }} />
        <button type="submit" disabled={creating} style={primaryButtonStyle}>
          + Add group
        </button>
      </form>
    </section>
  );
}
