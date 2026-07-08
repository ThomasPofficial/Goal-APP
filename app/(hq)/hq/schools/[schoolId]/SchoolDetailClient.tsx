"use client";

import { useState } from "react";
import Link from "next/link";

interface Member {
  profileId: string;
  userId: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  role: "STUDENT" | "ORG" | "ADMIN" | "SCHOOL";
  isAlumni: boolean;
  staffTitle: string | null;
  graduationYear: number | null;
  industry: string | null;
  intendedCollege: string | null;
  intendedMajor: string | null;
  isAvailableToMentor: boolean;
  createdAt: string;
}

interface School {
  id: string;
  email: string | null;
  createdAt: string;
  profile: {
    displayName: string;
    headline: string | null;
    advancementEmail: string | null;
  } | null;
}

interface Props {
  school: School;
  members: Member[];
}

type Tab = "students" | "alumni" | "staff" | "campaigns";

export default function SchoolDetailClient({ school, members }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("students");
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const displayName = school.profile?.displayName ?? school.email ?? school.id;
  const headline = school.profile?.headline ?? null;

  // Count stats
  const studentCount = members.filter(
    (m) => m.role === "STUDENT" && !m.isAlumni
  ).length;
  const alumniCount = members.filter((m) => m.isAlumni).length;
  const staffCount = members.filter((m) => m.staffTitle !== null).length;

  // Filter members per tab
  const getTabMembers = (): Member[] => {
    let list: Member[] = [];
    if (activeTab === "students") {
      list = members.filter((m) => m.role === "STUDENT" && !m.isAlumni);
    } else if (activeTab === "alumni") {
      list = members.filter((m) => m.isAlumni);
    } else if (activeTab === "staff") {
      list = members.filter((m) => m.staffTitle !== null);
    }
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (m) =>
        m.displayName.toLowerCase().includes(q) ||
        (m.email ?? "").toLowerCase().includes(q)
    );
  };

  const tabMembers = getTabMembers();

  const tabLabel = (tab: Tab) => {
    if (tab === "students") return "No students yet. Add one with the button above.";
    if (tab === "alumni") return "No alumni yet. Add one with the button above.";
    if (tab === "staff") return "No staff yet. Add one with the button above.";
    return "";
  };

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "students", label: "Students", count: studentCount },
    { key: "alumni", label: "Alumni", count: alumniCount },
    { key: "staff", label: "Staff", count: staffCount },
    { key: "campaigns", label: "Campaigns" },
  ];

  return (
    <div>
      {/* Back link */}
      <div style={{ marginBottom: 20 }}>
        <Link
          href="/hq"
          style={{
            fontSize: 13,
            color: "var(--muted)",
            textDecoration: "none",
            fontWeight: 500,
            letterSpacing: "0.01em",
          }}
        >
          &larr; Schools
        </Link>
      </div>

      {/* Header */}
      <div
        style={{
          marginBottom: 28,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 36,
            fontWeight: 700,
            color: "var(--text)",
            margin: 0,
            lineHeight: 1.1,
            letterSpacing: "0.01em",
          }}
        >
          {displayName}
        </h1>
        {headline && (
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
            {headline}
          </p>
        )}

        {/* Stat chips */}
        <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
          {(
            [
              { label: "Students", count: studentCount },
              { label: "Alumni", count: alumniCount },
              { label: "Staff", count: staffCount },
            ] as const
          ).map((chip) => (
            <span
              key={chip.label}
              style={{
                display: "inline-block",
                padding: "3px 12px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "var(--font-mono)",
                borderRadius: 0,
              }}
            >
              <span style={{ color: "var(--amber)", marginRight: 4 }}>
                {chip.count}
              </span>
              {chip.label}
            </span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setSearch("");
              }}
              style={{
                padding: "6px 16px",
                borderRadius: 0,
                border: isActive
                  ? "1px solid var(--amber)"
                  : "1px solid var(--border)",
                background: isActive ? "var(--amber)" : "transparent",
                color: isActive ? "#000" : "var(--muted)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                cursor: "pointer",
                transition: "all 0.15s",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  style={{
                    display: "inline-block",
                    minWidth: 18,
                    textAlign: "center",
                    background: isActive
                      ? "rgba(0,0,0,0.15)"
                      : "rgba(255,255,255,0.08)",
                    borderRadius: 0,
                    padding: "0 5px",
                    fontSize: 10,
                    lineHeight: "16px",
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Campaigns placeholder */}
      {activeTab === "campaigns" && (
        <p style={{ color: "var(--muted)" }}>
          Campaign management — coming in a future update.
        </p>
      )}

      {/* Member list tabs */}
      {activeTab !== "campaigns" && (
        <div>
          {/* Search + action buttons */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 16,
              flexWrap: "wrap",
            }}
          >
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              style={{
                flex: "1 1 200px",
                padding: "8px 12px",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text)",
                fontSize: 13,
                borderRadius: 0,
                outline: "none",
                fontFamily: "inherit",
              }}
            />
            <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
              <button
                onClick={() => setShowImportModal(true)}
                style={{
                  padding: "8px 16px",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  borderRadius: 0,
                  whiteSpace: "nowrap",
                }}
              >
                Import CSV
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                style={{
                  padding: "8px 16px",
                  background: "var(--amber)",
                  border: "1px solid var(--amber)",
                  color: "#000",
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  borderRadius: 0,
                  whiteSpace: "nowrap",
                }}
              >
                + Add Member
              </button>
            </div>
          </div>

          {/* Modal placeholders */}
          {showAddModal && (
            <div
              style={{
                border: "1px solid var(--border)",
                background: "var(--surface)",
                padding: "20px 24px",
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: 14, color: "var(--muted)" }}>
                Add Member Modal — coming soon
              </span>
              <button
                onClick={() => setShowAddModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--muted)",
                  cursor: "pointer",
                  fontSize: 18,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                &times;
              </button>
            </div>
          )}

          {showImportModal && (
            <div
              style={{
                border: "1px solid var(--border)",
                background: "var(--surface)",
                padding: "20px 24px",
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: 14, color: "var(--muted)" }}>
                CSV Import — coming soon
              </span>
              <button
                onClick={() => setShowImportModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--muted)",
                  cursor: "pointer",
                  fontSize: 18,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                &times;
              </button>
            </div>
          )}

          {/* Empty state */}
          {tabMembers.length === 0 && (
            <div
              style={{
                border: "1px solid var(--border)",
                background: "var(--surface)",
                padding: "48px 32px",
                textAlign: "center",
                borderRadius: 0,
              }}
            >
              <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
                {search
                  ? `No results for "${search}".`
                  : tabLabel(activeTab)}
              </p>
            </div>
          )}

          {/* Member rows */}
          {tabMembers.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {tabMembers.map((m) => {
                const subtitle =
                  m.staffTitle ??
                  (m.graduationYear
                    ? `Class of ${m.graduationYear}`
                    : m.intendedMajor ?? m.industry ?? null);

                const badgeLabel = m.isAlumni
                  ? "ALUMNI"
                  : m.staffTitle
                  ? "STAFF"
                  : m.role;

                return (
                  <div
                    key={m.profileId}
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      padding: "14px 16px",
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      borderRadius: 0,
                    }}
                  >
                    {/* Identity */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 14,
                          color: "var(--text)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {m.displayName}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          marginTop: 3,
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        {m.email && (
                          <span
                            style={{
                              fontSize: 12,
                              color: "var(--muted)",
                            }}
                          >
                            {m.email}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--muted)",
                          }}
                        >
                          {m.phone ?? "—"}
                        </span>
                        {subtitle && (
                          <span
                            style={{
                              fontSize: 12,
                              color: "var(--muted)",
                            }}
                          >
                            {subtitle}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Role badge */}
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        fontWeight: 700,
                        color: "var(--amber)",
                        background: "rgba(232,137,58,0.12)",
                        padding: "2px 8px",
                        borderRadius: 0,
                        letterSpacing: "0.1em",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {badgeLabel}
                    </span>

                    {/* System ID */}
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        color: "var(--muted)",
                        opacity: 0.5,
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {m.userId.slice(0, 8)}…
                    </span>

                    {/* Action stubs */}
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button
                        disabled
                        title="Edit (coming soon)"
                        style={{
                          padding: "5px 10px",
                          background: "transparent",
                          border: "1px solid var(--border)",
                          color: "var(--muted)",
                          cursor: "not-allowed",
                          borderRadius: 0,
                          fontSize: 12,
                          opacity: 0.5,
                        }}
                      >
                        ✏
                      </button>
                      <button
                        disabled
                        title="Remove (coming soon)"
                        style={{
                          padding: "5px 10px",
                          background: "transparent",
                          border: "1px solid var(--border)",
                          color: "var(--muted)",
                          cursor: "not-allowed",
                          borderRadius: 0,
                          fontSize: 12,
                          opacity: 0.5,
                        }}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
