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

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: 13,
  borderRadius: 0,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  letterSpacing: "0.08em",
  color: "var(--muted)",
  marginBottom: 6,
  textTransform: "uppercase",
};

export default function SchoolDetailClient({ school, members: initialMembers }: Props) {
  const [members, setMembers] = useState(initialMembers);
  const [activeTab, setActiveTab] = useState<Tab>("students");
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Add Member modal form state
  const [addRole, setAddRole] = useState<"STUDENT" | "ALUMNI" | "STAFF">("STUDENT");
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addGradYear, setAddGradYear] = useState("");
  const [addIntendedCollege, setAddIntendedCollege] = useState("");
  const [addIntendedMajor, setAddIntendedMajor] = useState("");
  const [addIndustry, setAddIndustry] = useState("");
  const [addMentor, setAddMentor] = useState(false);
  const [addJobTitle, setAddJobTitle] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  // Edit Member modal state
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editGradYear, setEditGradYear] = useState("");
  const [editIntendedCollege, setEditIntendedCollege] = useState("");
  const [editIntendedMajor, setEditIntendedMajor] = useState("");
  const [editIndustry, setEditIndustry] = useState("");
  const [editMentor, setEditMentor] = useState(false);
  const [editJobTitle, setEditJobTitle] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  // Remove state
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const resetAddForm = () => {
    setAddRole("STUDENT");
    setAddName("");
    setAddEmail("");
    setAddPhone("");
    setAddGradYear("");
    setAddIntendedCollege("");
    setAddIntendedMajor("");
    setAddIndustry("");
    setAddMentor(false);
    setAddJobTitle("");
    setAddError(null);
    setAddLoading(false);
  };

  const refreshMembers = async () => {
    try {
      const res = await fetch(`/api/hq/schools/${school.id}`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members);
      }
    } catch {
      // ignore refresh errors silently
    }
  };

  const handleAddMember = async () => {
    if (!addName.trim() || !addEmail.trim()) {
      setAddError("Name and email are required.");
      return;
    }
    if (addRole === "STAFF" && !addJobTitle.trim()) {
      setAddError("Job title is required for staff.");
      return;
    }
    setAddLoading(true);
    setAddError(null);
    try {
      const res = await fetch(`/api/hq/schools/${school.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: addName.trim(),
          email: addEmail.trim(),
          phone: addPhone.trim() || undefined,
          role: addRole,
          graduationYear: addGradYear ? Number(addGradYear) : undefined,
          intendedCollege: addIntendedCollege.trim() || undefined,
          intendedMajor: addIntendedMajor.trim() || undefined,
          industry: addIndustry.trim() || undefined,
          isAvailableToMentor: addMentor,
          jobTitle: addJobTitle.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error ?? "Failed to add member.");
        setAddLoading(false);
        return;
      }
      setShowAddModal(false);
      resetAddForm();
      await refreshMembers();
    } catch {
      setAddError("Network error. Please try again.");
      setAddLoading(false);
    }
  };

  const openEditModal = (m: Member) => {
    setEditingMember(m);
    setEditName(m.displayName);
    setEditPhone(m.phone ?? "");
    setEditGradYear(m.graduationYear ? String(m.graduationYear) : "");
    setEditIntendedCollege(m.intendedCollege ?? "");
    setEditIntendedMajor(m.intendedMajor ?? "");
    setEditIndustry(m.industry ?? "");
    setEditMentor(m.isAvailableToMentor);
    setEditJobTitle(m.staffTitle ?? "");
    setEditError(null);
    setEditLoading(false);
  };

  const closeEditModal = () => {
    setEditingMember(null);
    setEditError(null);
    setEditLoading(false);
  };

  const handleEditMember = async () => {
    if (!editingMember) return;
    if (!editName.trim()) {
      setEditError("Display name is required.");
      return;
    }
    setEditLoading(true);
    setEditError(null);
    try {
      const isStaff = editingMember.staffTitle !== null;
      const isAlumni = editingMember.isAlumni;
      const res = await fetch(
        `/api/hq/schools/${school.id}/members/${editingMember.userId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: editName.trim(),
            phone: editPhone.trim() || undefined,
            ...(isStaff
              ? { jobTitle: editJobTitle.trim() || undefined }
              : isAlumni
              ? {
                  graduationYear: editGradYear ? Number(editGradYear) : undefined,
                  industry: editIndustry.trim() || undefined,
                  intendedCollege: editIntendedCollege.trim() || undefined,
                  isAvailableToMentor: editMentor,
                }
              : {
                  graduationYear: editGradYear ? Number(editGradYear) : undefined,
                  intendedCollege: editIntendedCollege.trim() || undefined,
                  intendedMajor: editIntendedMajor.trim() || undefined,
                }),
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error ?? "Failed to save changes.");
        setEditLoading(false);
        return;
      }
      closeEditModal();
      await refreshMembers();
    } catch {
      setEditError("Network error. Please try again.");
      setEditLoading(false);
    }
  };

  const handleRemoveMember = async (m: Member) => {
    const confirmed = window.confirm(
      `Remove ${m.displayName} from this school? They will lose access to the school community.`
    );
    if (!confirmed) return;
    setRemovingId(m.userId);
    setRemoveError(null);
    try {
      const res = await fetch(
        `/api/hq/schools/${school.id}/members/${m.userId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json();
        setRemoveError(data.error ?? "Failed to remove member.");
      } else {
        await refreshMembers();
      }
    } catch {
      setRemoveError("Network error. Please try again.");
    } finally {
      setRemovingId(null);
    }
  };

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
                onClick={() => { resetAddForm(); setShowAddModal(true); }}
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

          {/* Import CSV placeholder */}
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

          {/* Remove error */}
          {removeError && (
            <div
              style={{
                border: "1px solid rgba(239,68,68,0.4)",
                background: "rgba(239,68,68,0.08)",
                padding: "10px 14px",
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 13, color: "#ef4444", fontFamily: "var(--font-mono)" }}>
                {removeError}
              </span>
              <button
                onClick={() => setRemoveError(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#ef4444",
                  cursor: "pointer",
                  fontSize: 18,
                  lineHeight: 1,
                  padding: 0,
                  flexShrink: 0,
                }}
              >
                &times;
              </button>
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

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => openEditModal(m)}
                        title="Edit member"
                        style={{
                          padding: "5px 10px",
                          background: "transparent",
                          border: "1px solid var(--border)",
                          color: "var(--n-text2)",
                          cursor: "pointer",
                          borderRadius: 0,
                          fontSize: 12,
                        }}
                      >
                        ✏
                      </button>
                      <button
                        onClick={() => handleRemoveMember(m)}
                        disabled={removingId === m.userId}
                        title="Remove member"
                        style={{
                          padding: "5px 10px",
                          background: "transparent",
                          border: `1px solid ${removingId === m.userId ? "var(--border)" : "rgba(239,68,68,0.4)"}`,
                          color: removingId === m.userId ? "var(--muted)" : "#ef4444",
                          cursor: removingId === m.userId ? "not-allowed" : "pointer",
                          borderRadius: 0,
                          fontSize: 12,
                          opacity: removingId === m.userId ? 0.6 : 1,
                        }}
                      >
                        {removingId === m.userId ? "Removing…" : "🗑"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Edit Member Modal */}
      {editingMember && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeEditModal();
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 0,
              padding: 28,
              width: "100%",
              maxWidth: 480,
              position: "relative",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            {/* Close button */}
            <button
              onClick={closeEditModal}
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                background: "none",
                border: "none",
                color: "var(--muted)",
                cursor: "pointer",
                fontSize: 22,
                lineHeight: 1,
                padding: 0,
              }}
            >
              &times;
            </button>

            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 20,
                fontWeight: 700,
                margin: "0 0 20px",
                color: "var(--text)",
              }}
            >
              Edit Member
            </h2>

            {/* Display Name */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Display Name *</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Jane Smith"
                style={inputStyle}
              />
            </div>

            {/* Phone */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Phone</label>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                style={inputStyle}
              />
            </div>

            {/* Role-specific fields */}
            {editingMember.staffTitle !== null ? (
              /* Staff fields */
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Job Title</label>
                <input
                  type="text"
                  value={editJobTitle}
                  onChange={(e) => setEditJobTitle(e.target.value)}
                  placeholder="School Counselor"
                  style={inputStyle}
                />
              </div>
            ) : editingMember.isAlumni ? (
              /* Alumni fields */
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Graduation Year</label>
                  <input
                    type="number"
                    value={editGradYear}
                    onChange={(e) => setEditGradYear(e.target.value)}
                    placeholder="2020"
                    style={inputStyle}
                  />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Industry</label>
                  <input
                    type="text"
                    value={editIndustry}
                    onChange={(e) => setEditIndustry(e.target.value)}
                    placeholder="Technology"
                    style={inputStyle}
                  />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>College Attended</label>
                  <input
                    type="text"
                    value={editIntendedCollege}
                    onChange={(e) => setEditIntendedCollege(e.target.value)}
                    placeholder="Stanford University"
                    style={inputStyle}
                  />
                </div>
                <div style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    id="editMentor"
                    checked={editMentor}
                    onChange={(e) => setEditMentor(e.target.checked)}
                    style={{ width: 16, height: 16, cursor: "pointer", accentColor: "var(--amber)" }}
                  />
                  <label
                    htmlFor="editMentor"
                    style={{
                      fontSize: 13,
                      color: "var(--text)",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    Open to mentoring students
                  </label>
                </div>
              </>
            ) : (
              /* Student fields */
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Graduation Year</label>
                  <input
                    type="number"
                    value={editGradYear}
                    onChange={(e) => setEditGradYear(e.target.value)}
                    placeholder="2026"
                    style={inputStyle}
                  />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Intended College</label>
                  <input
                    type="text"
                    value={editIntendedCollege}
                    onChange={(e) => setEditIntendedCollege(e.target.value)}
                    placeholder="MIT"
                    style={inputStyle}
                  />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Intended Major</label>
                  <input
                    type="text"
                    value={editIntendedMajor}
                    onChange={(e) => setEditIntendedMajor(e.target.value)}
                    placeholder="Computer Science"
                    style={inputStyle}
                  />
                </div>
              </>
            )}

            {/* Error */}
            {editError && (
              <p
                style={{
                  color: "#e05",
                  fontSize: 13,
                  margin: "0 0 12px",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {editError}
              </p>
            )}

            {/* Submit */}
            <button
              onClick={handleEditMember}
              disabled={editLoading}
              style={{
                width: "100%",
                padding: "10px 0",
                background: "var(--amber)",
                border: "1px solid var(--amber)",
                color: "#000",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                cursor: editLoading ? "not-allowed" : "pointer",
                borderRadius: 0,
                opacity: editLoading ? 0.7 : 1,
                marginTop: 4,
              }}
            >
              {editLoading ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddModal(false);
              resetAddForm();
            }
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 0,
              padding: 28,
              width: "100%",
              maxWidth: 480,
              position: "relative",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            {/* Close button */}
            <button
              onClick={() => { setShowAddModal(false); resetAddForm(); }}
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                background: "none",
                border: "none",
                color: "var(--muted)",
                cursor: "pointer",
                fontSize: 22,
                lineHeight: 1,
                padding: 0,
              }}
            >
              &times;
            </button>

            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 20,
                fontWeight: 700,
                margin: "0 0 20px",
                color: "var(--text)",
              }}
            >
              Add Member
            </h2>

            {/* Role selector */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Role</label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["STUDENT", "ALUMNI", "STAFF"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setAddRole(r)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 0,
                      border:
                        addRole === r
                          ? "1px solid var(--amber)"
                          : "1px solid var(--border)",
                      background: addRole === r ? "var(--amber)" : "transparent",
                      color: addRole === r ? "#000" : "var(--muted)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                    }}
                  >
                    {r === "STUDENT" ? "Student" : r === "ALUMNI" ? "Alumni" : "Staff"}
                  </button>
                ))}
              </div>
            </div>

            {/* Full Name */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Full Name *</label>
              <input
                type="text"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Jane Smith"
                style={inputStyle}
              />
            </div>

            {/* Email */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Email *</label>
              <input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="jane@school.edu"
                style={inputStyle}
              />
            </div>

            {/* Phone */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Phone</label>
              <input
                type="tel"
                value={addPhone}
                onChange={(e) => setAddPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                style={inputStyle}
              />
            </div>

            {/* Student-specific fields */}
            {addRole === "STUDENT" && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Graduation Year</label>
                  <input
                    type="number"
                    value={addGradYear}
                    onChange={(e) => setAddGradYear(e.target.value)}
                    placeholder="2026"
                    style={inputStyle}
                  />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Intended College</label>
                  <input
                    type="text"
                    value={addIntendedCollege}
                    onChange={(e) => setAddIntendedCollege(e.target.value)}
                    placeholder="MIT"
                    style={inputStyle}
                  />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Intended Major</label>
                  <input
                    type="text"
                    value={addIntendedMajor}
                    onChange={(e) => setAddIntendedMajor(e.target.value)}
                    placeholder="Computer Science"
                    style={inputStyle}
                  />
                </div>
              </>
            )}

            {/* Alumni-specific fields */}
            {addRole === "ALUMNI" && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Graduation Year</label>
                  <input
                    type="number"
                    value={addGradYear}
                    onChange={(e) => setAddGradYear(e.target.value)}
                    placeholder="2020"
                    style={inputStyle}
                  />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Industry</label>
                  <input
                    type="text"
                    value={addIndustry}
                    onChange={(e) => setAddIndustry(e.target.value)}
                    placeholder="Technology"
                    style={inputStyle}
                  />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>College Attended</label>
                  <input
                    type="text"
                    value={addIntendedCollege}
                    onChange={(e) => setAddIntendedCollege(e.target.value)}
                    placeholder="Stanford University"
                    style={inputStyle}
                  />
                </div>
                <div style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    id="addMentor"
                    checked={addMentor}
                    onChange={(e) => setAddMentor(e.target.checked)}
                    style={{ width: 16, height: 16, cursor: "pointer", accentColor: "var(--amber)" }}
                  />
                  <label
                    htmlFor="addMentor"
                    style={{
                      fontSize: 13,
                      color: "var(--text)",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    Open to mentoring students
                  </label>
                </div>
              </>
            )}

            {/* Staff-specific fields */}
            {addRole === "STAFF" && (
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Job Title *</label>
                <input
                  type="text"
                  value={addJobTitle}
                  onChange={(e) => setAddJobTitle(e.target.value)}
                  placeholder="School Counselor"
                  style={inputStyle}
                />
              </div>
            )}

            {/* Error */}
            {addError && (
              <p
                style={{
                  color: "#e05",
                  fontSize: 13,
                  margin: "0 0 12px",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {addError}
              </p>
            )}

            {/* Submit */}
            <button
              onClick={handleAddMember}
              disabled={addLoading}
              style={{
                width: "100%",
                padding: "10px 0",
                background: "var(--amber)",
                border: "1px solid var(--amber)",
                color: "#000",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                cursor: addLoading ? "not-allowed" : "pointer",
                borderRadius: 0,
                opacity: addLoading ? 0.7 : 1,
                marginTop: 4,
              }}
            >
              {addLoading ? "Adding…" : "Add Member"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
