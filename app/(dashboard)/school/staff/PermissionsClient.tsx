"use client";

import { useEffect, useState } from "react";
import type { Capability } from "@/lib/facultyPermissions";
import PeopleTab from "./PeopleTab";
import GroupsTab from "./GroupsTab";
import AdminsTab from "./AdminsTab";

export interface Group {
  id: string;
  name: string;
  permissions: Capability[];
  isSystemDefault: boolean;
}

export interface Person {
  userId: string;
  email: string | null;
  displayName: string;
  staffTitle: string | null;
  tierId: string | null;
  tierName: string | null;
  isCustom: boolean;
  isCoreAdmin: boolean;
  overrides: Capability[];
  revocations: Capability[];
  isPending: boolean;
}

interface StaffApiRow {
  userId: string;
  email: string | null;
  displayName: string;
  staffTitle: string | null;
  tierId: string | null;
  tierName: string | null;
  isCustom: boolean;
  isCoreAdmin: boolean;
  overrides: Capability[];
  revocations: Capability[];
}

interface Props {
  isOwnerOrCoreAdmin: boolean;
  initialGroups: Group[];
}

type Tab = "people" | "groups" | "admins";

export default function PermissionsClient({ isOwnerOrCoreAdmin, initialGroups }: Props) {
  const [tab, setTab] = useState<Tab>("people");
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [people, setPeople] = useState<Person[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(true);

  function toPerson(row: StaffApiRow, isPending: boolean): Person {
    return { ...row, isPending };
  }

  async function refreshPeople() {
    setLoadingPeople(true);
    try {
      const res = await fetch("/api/school/staff");
      const data = await res.json();
      setPeople([
        ...((data.staff ?? []) as StaffApiRow[]).map((r) => toPerson(r, false)),
        ...((data.pendingInvites ?? []) as StaffApiRow[]).map((r) => toPerson(r, true)),
      ]);
    } finally {
      setLoadingPeople(false);
    }
  }

  async function refreshGroups() {
    const res = await fetch("/api/school/staff/tiers");
    const data = await res.json();
    setGroups(data.tiers ?? []);
  }

  useEffect(() => {
    refreshPeople();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tabs: { key: Tab; label: string }[] = [
    { key: "people", label: "People" },
    ...(isOwnerOrCoreAdmin ? ([{ key: "groups", label: "Groups" }, { key: "admins", label: "Admins" }] as { key: Tab; label: string }[]) : []),
  ];

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 700, color: "var(--text)", margin: 0, lineHeight: 1.1 }}>
          Permissions
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: "6px 0 0" }}>
          Add people, name permission groups, and manage who can manage this school.
        </p>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid var(--border)" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "10px 16px",
              background: "none",
              border: "none",
              borderBottom: tab === t.key ? "2px solid var(--amber)" : "2px solid transparent",
              color: tab === t.key ? "var(--text)" : "var(--muted)",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "people" && (
        <PeopleTab people={people} loading={loadingPeople} groups={groups} isOwnerOrCoreAdmin={isOwnerOrCoreAdmin} onChanged={refreshPeople} />
      )}
      {tab === "groups" && isOwnerOrCoreAdmin && <GroupsTab groups={groups} onChanged={refreshGroups} />}
      {tab === "admins" && isOwnerOrCoreAdmin && <AdminsTab onChanged={refreshPeople} />}
    </div>
  );
}
