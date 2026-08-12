"use client";

import { useState } from "react";

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
  emailVerified: string | null;
}

interface ParsedRow {
  displayName: string;
  email: string;
  phone: string;
  role: string;
  graduationYear: string;
  college: string;
  major: string;
  industry: string;
  isMentor: string;
  jobTitle: string;
}

interface Props {
  members: Member[];
}

type Tab = "students" | "alumni" | "staff";

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/\s+/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] ?? "";
    });
    return {
      displayName: obj["name"] || obj["displayname"] || "",
      email: obj["email"] || "",
      phone: obj["phone"] || "",
      role: (obj["role"] || "STUDENT").toUpperCase(),
      graduationYear: obj["graduationyear"] || obj["gradyear"] || "",
      college: obj["college"] || "",
      major: obj["major"] || "",
      industry: obj["industry"] || "",
      isMentor: obj["ismentor"] || obj["mentor"] || "",
      jobTitle: obj["jobtitle"] || obj["title"] || "",
    };
  });
}

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

export default function RosterClient({ members: initialMembers }: Props) {
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
  const [addedInviteUrl, setAddedInviteUrl] = useState<string | null>(null);
  const [addedMemberName, setAddedMemberName] = useState<string>("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);

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

  // Import CSV modal state
  const [importStep, setImportStep] = useState<"input" | "review" | "result">("input");
  const [csvText, setCsvText] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
    invites: { email: string; name: string; activateUrl: string }[];
  } | null>(null);
  const [importing, setImporting] = useState(false);

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

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
    } catch {
      window.prompt("Couldn't copy automatically — copy this link manually:", text);
    }
  };

  const refreshMembers = async () => {
    try {
      const res = await fetch("/api/school/roster");
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
      const res = await fetch("/api/school/roster/members", {
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
      setAddedMemberName(addName.trim());
      setAddedInviteUrl(data.activateUrl ?? null);
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
        `/api/school/roster/members/${editingMember.userId}`,
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
        `/api/school/roster/members/${m.userId}`,
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

  const handleCopyInviteLink = async (m: Member) => {
    setResendError(null);
    setResendingId(m.userId);
    try {
      const res = await fetch(
        `/api/school/roster/members/${m.userId}/resend-invite`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        setResendError(data.error ?? "Failed to generate invite link.");
        return;
      }
      await copyToClipboard(data.activateUrl, m.userId);
    } catch {
      setResendError("Network error. Please try again.");
    } finally {
      setResendingId(null);
    }
  };

  const resetImportModal = () => {
    setImportStep("input");
    setCsvText("");
    setParsedRows([]);
    setImportResult(null);
    setImporting(false);
  };

  const updateRow = (index: number, field: keyof ParsedRow, value: string) => {
    setParsedRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvText((ev.target?.result as string) ?? "");
    };
    reader.readAsText(file);
  };

  const handleParseAndReview = () => {
    const rows = parseCSV(csvText);
    if (rows.length === 0) return;
    setParsedRows(rows);
    setImportStep("review");
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await fetch("/api/school/roster/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parsedRows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportResult({
          imported: 0,
          skipped: parsedRows.length,
          errors: [data.error ?? "Import failed"],
          invites: [],
        });
      } else {
        setImportResult(data);
      }
      setImportStep("result");
    } catch {
      setImportResult({
        imported: 0,
        skipped: parsedRows.length,
        errors: ["Network error. Please try again."],
        invites: [],
      });
      setImportStep("result");
    } finally {
      setImporting(false);
    }
  };

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

  const memberEmailSet = new Set(
    members.map((m) => (m.email ?? "").toLowerCase()).filter(Boolean)
  );

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
  ];

  return (
    <div>
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
          Roster
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
          Manage your school&apos;s students, alumni, and staff.
        </p>

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

      {/* Member list tabs */}
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

          {/* Import CSV Modal */}
          {showImportModal && (
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
                  setShowImportModal(false);
                  resetImportModal();
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
                  maxWidth: 680,
                  position: "relative",
                  maxHeight: "90vh",
                  overflowY: "auto",
                }}
              >
                {/* Close button */}
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    resetImportModal();
                  }}
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

                {/* Step 1: Input */}
                {importStep === "input" && (
                  <>
                    <h2
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 20,
                        fontWeight: 700,
                        margin: "0 0 6px",
                        color: "var(--text)",
                      }}
                    >
                      Import Members from CSV
                    </h2>
                    <p
                      style={{
                        fontSize: 12,
                        color: "var(--muted)",
                        fontFamily: "var(--font-mono)",
                        margin: "0 0 20px",
                        lineHeight: 1.6,
                      }}
                    >
                      Expected format: name, email, phone, role, graduationYear,
                      college, major, industry, isMentor, jobTitle
                    </p>

                    <div style={{ marginBottom: 14 }}>
                      <label style={labelStyle}>Upload CSV File</label>
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        style={{
                          display: "block",
                          fontSize: 13,
                          color: "var(--text)",
                          cursor: "pointer",
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: 20 }}>
                      <label style={labelStyle}>Or Paste CSV Text</label>
                      <textarea
                        value={csvText}
                        onChange={(e) => setCsvText(e.target.value)}
                        rows={8}
                        placeholder={
                          "name,email,phone,role,graduationYear,college,major,industry,isMentor,jobTitle\nJane Smith,jane@school.edu,,STUDENT,2026,MIT,CS,,,"
                        }
                        style={{
                          ...inputStyle,
                          resize: "vertical",
                          fontFamily: "var(--font-mono)",
                          fontSize: 12,
                        }}
                      />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: 10,
                      }}
                    >
                      <button
                        onClick={() => {
                          setShowImportModal(false);
                          resetImportModal();
                        }}
                        style={{
                          padding: "8px 20px",
                          background: "transparent",
                          border: "1px solid var(--border)",
                          color: "var(--muted)",
                          fontFamily: "var(--font-mono)",
                          fontSize: 12,
                          fontWeight: 600,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          cursor: "pointer",
                          borderRadius: 0,
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleParseAndReview}
                        disabled={!csvText.trim()}
                        style={{
                          padding: "8px 20px",
                          background: "var(--amber)",
                          border: "1px solid var(--amber)",
                          color: "#000",
                          fontFamily: "var(--font-mono)",
                          fontSize: 12,
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          cursor: csvText.trim() ? "pointer" : "not-allowed",
                          borderRadius: 0,
                          opacity: csvText.trim() ? 1 : 0.5,
                        }}
                      >
                        Parse &amp; Review →
                      </button>
                    </div>
                  </>
                )}

                {/* Step 2: Review */}
                {importStep === "review" && (
                  <>
                    <h2
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 20,
                        fontWeight: 700,
                        margin: "0 0 6px",
                        color: "var(--text)",
                      }}
                    >
                      Review {parsedRows.length} Row
                      {parsedRows.length !== 1 ? "s" : ""}
                    </h2>
                    <p
                      style={{
                        fontSize: 12,
                        color: "var(--muted)",
                        margin: "0 0 16px",
                        lineHeight: 1.5,
                      }}
                    >
                      Red rows are missing email and will be skipped. Yellow
                      rows have an email that already exists in the member list.
                    </p>

                    <div
                      style={{
                        maxHeight: 360,
                        overflowY: "auto",
                        marginBottom: 16,
                        border: "1px solid var(--border)",
                      }}
                    >
                      <table
                        style={{
                          width: "100%",
                          fontSize: 12,
                          borderCollapse: "collapse",
                        }}
                      >
                        <thead>
                          <tr
                            style={{
                              background: "var(--bg)",
                              position: "sticky",
                              top: 0,
                              zIndex: 1,
                            }}
                          >
                            {(
                              [
                                "Name",
                                "Email",
                                "Phone",
                                "Role",
                                "College / Industry",
                                "Notes",
                              ] as const
                            ).map((col) => (
                              <th
                                key={col}
                                style={{
                                  textAlign: "left",
                                  padding: "6px 8px",
                                  fontFamily: "var(--font-mono)",
                                  fontSize: 10,
                                  fontWeight: 700,
                                  letterSpacing: "0.08em",
                                  textTransform: "uppercase",
                                  color: "var(--muted)",
                                  borderBottom: "1px solid var(--border)",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {parsedRows.map((row, i) => {
                            const noEmail = !row.email.trim();
                            const isDup =
                              !noEmail &&
                              memberEmailSet.has(row.email.trim().toLowerCase());
                            const rowBg = noEmail
                              ? "rgba(239,68,68,0.08)"
                              : isDup
                              ? "rgba(234,179,8,0.08)"
                              : "var(--surface)";
                            const rowBorderLeft = noEmail
                              ? "3px solid #ef4444"
                              : isDup
                              ? "3px solid #eab308"
                              : "3px solid transparent";
                            return (
                              <tr
                                key={i}
                                style={{
                                  background: rowBg,
                                  borderLeft: rowBorderLeft,
                                }}
                              >
                                <td style={{ padding: "4px 8px" }}>
                                  <input
                                    value={row.displayName}
                                    onChange={(e) =>
                                      updateRow(i, "displayName", e.target.value)
                                    }
                                    style={{
                                      width: "100%",
                                      background: "transparent",
                                      border: "1px solid transparent",
                                      color: "var(--text)",
                                      fontSize: 12,
                                      fontFamily: "inherit",
                                      padding: "2px 4px",
                                      outline: "none",
                                      borderRadius: 0,
                                      boxSizing: "border-box",
                                    }}
                                    onFocus={(e) =>
                                      (e.target.style.borderColor =
                                        "var(--border)")
                                    }
                                    onBlur={(e) =>
                                      (e.target.style.borderColor = "transparent")
                                    }
                                  />
                                </td>
                                <td style={{ padding: "4px 8px" }}>
                                  <input
                                    value={row.email}
                                    onChange={(e) =>
                                      updateRow(i, "email", e.target.value)
                                    }
                                    style={{
                                      width: "100%",
                                      background: "transparent",
                                      border: "1px solid transparent",
                                      color: "var(--text)",
                                      fontSize: 12,
                                      fontFamily: "inherit",
                                      padding: "2px 4px",
                                      outline: "none",
                                      borderRadius: 0,
                                      boxSizing: "border-box",
                                    }}
                                    onFocus={(e) =>
                                      (e.target.style.borderColor =
                                        "var(--border)")
                                    }
                                    onBlur={(e) =>
                                      (e.target.style.borderColor = "transparent")
                                    }
                                  />
                                </td>
                                <td
                                  style={{
                                    padding: "4px 8px",
                                    color: "var(--muted)",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {row.phone || "—"}
                                </td>
                                <td
                                  style={{
                                    padding: "4px 8px",
                                    color: "var(--muted)",
                                    whiteSpace: "nowrap",
                                    fontFamily: "var(--font-mono)",
                                    fontSize: 10,
                                  }}
                                >
                                  {row.role}
                                </td>
                                <td
                                  style={{
                                    padding: "4px 8px",
                                    color: "var(--muted)",
                                  }}
                                >
                                  {row.college || row.industry || "—"}
                                </td>
                                <td
                                  style={{
                                    padding: "4px 8px",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {noEmail ? (
                                    <span
                                      style={{
                                        color: "#ef4444",
                                        fontFamily: "var(--font-mono)",
                                        fontSize: 10,
                                      }}
                                    >
                                      Missing email
                                    </span>
                                  ) : isDup ? (
                                    <span
                                      style={{
                                        color: "#eab308",
                                        fontFamily: "var(--font-mono)",
                                        fontSize: 10,
                                      }}
                                    >
                                      Duplicate
                                    </span>
                                  ) : null}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <button
                        onClick={() => setImportStep("input")}
                        style={{
                          padding: "8px 16px",
                          background: "transparent",
                          border: "1px solid var(--border)",
                          color: "var(--muted)",
                          fontFamily: "var(--font-mono)",
                          fontSize: 12,
                          fontWeight: 600,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          cursor: "pointer",
                          borderRadius: 0,
                        }}
                      >
                        ← Back
                      </button>
                      <button
                        onClick={handleImport}
                        disabled={importing}
                        style={{
                          padding: "8px 24px",
                          background: "var(--amber)",
                          border: "1px solid var(--amber)",
                          color: "#000",
                          fontFamily: "var(--font-mono)",
                          fontSize: 12,
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          cursor: importing ? "not-allowed" : "pointer",
                          borderRadius: 0,
                          opacity: importing ? 0.7 : 1,
                        }}
                      >
                        {importing
                          ? "Importing…"
                          : `Import All (${parsedRows.length})`}
                      </button>
                    </div>
                  </>
                )}

                {/* Step 3: Result */}
                {importStep === "result" && importResult && (
                  <>
                    <h2
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 20,
                        fontWeight: 700,
                        margin: "0 0 16px",
                        color: "var(--text)",
                      }}
                    >
                      Import Complete
                    </h2>

                    <p
                      style={{
                        fontSize: 15,
                        color: "var(--text)",
                        margin: "0 0 16px",
                        fontWeight: 600,
                      }}
                    >
                      ✓ {importResult.imported} member
                      {importResult.imported !== 1 ? "s" : ""} imported
                      {importResult.skipped > 0
                        ? `, ${importResult.skipped} skipped`
                        : ""}
                    </p>

                    {importResult.errors.length > 0 && (
                      <div
                        style={{
                          border: "1px solid rgba(239,68,68,0.4)",
                          background: "rgba(239,68,68,0.06)",
                          padding: "12px 16px",
                          marginBottom: 16,
                        }}
                      >
                        <p
                          style={{
                            fontSize: 11,
                            fontFamily: "var(--font-mono)",
                            color: "#ef4444",
                            margin: "0 0 8px",
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                          }}
                        >
                          Errors ({importResult.errors.length})
                        </p>
                        <ul style={{ margin: 0, padding: "0 0 0 16px" }}>
                          {importResult.errors.map((err, i) => (
                            <li
                              key={i}
                              style={{
                                fontSize: 12,
                                color: "#ef4444",
                                marginBottom: 4,
                                fontFamily: "var(--font-mono)",
                              }}
                            >
                              {err}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {importResult.invites.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 8,
                          }}
                        >
                          <p
                            style={{
                              fontSize: 12,
                              color: "var(--muted)",
                              margin: 0,
                              lineHeight: 1.5,
                            }}
                          >
                            Since we don&apos;t send these automatically yet, here are
                            their setup links to share:
                          </p>
                          <button
                            onClick={() => {
                              const block = importResult.invites
                                .map((inv) => `${inv.name} <${inv.email}>: ${inv.activateUrl}`)
                                .join("\n");
                              copyToClipboard(block, "import-all");
                            }}
                            style={{
                              padding: "5px 12px",
                              background: "transparent",
                              border: "1px solid var(--border)",
                              color: "var(--text)",
                              fontFamily: "var(--font-mono)",
                              fontSize: 11,
                              fontWeight: 700,
                              letterSpacing: "0.06em",
                              textTransform: "uppercase",
                              cursor: "pointer",
                              borderRadius: 0,
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                            }}
                          >
                            {copiedKey === "import-all" ? "Copied!" : "Copy All Links"}
                          </button>
                        </div>
                        <div
                          style={{
                            maxHeight: 200,
                            overflowY: "auto",
                            border: "1px solid var(--border)",
                          }}
                        >
                          {importResult.invites.map((inv, i) => (
                            <div
                              key={i}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "6px 10px",
                                borderBottom:
                                  i < importResult.invites.length - 1
                                    ? "1px solid var(--border)"
                                    : "none",
                              }}
                            >
                              <span style={{ fontSize: 12, color: "var(--text)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {inv.name} <span style={{ color: "var(--muted)" }}>({inv.email})</span>
                              </span>
                              <button
                                onClick={() => copyToClipboard(inv.activateUrl, `import-${i}`)}
                                style={{
                                  padding: "4px 10px",
                                  background: "transparent",
                                  border: "1px solid var(--amber)",
                                  color: "var(--amber)",
                                  fontFamily: "var(--font-mono)",
                                  fontSize: 10,
                                  fontWeight: 700,
                                  letterSpacing: "0.04em",
                                  cursor: "pointer",
                                  borderRadius: 0,
                                  whiteSpace: "nowrap",
                                  flexShrink: 0,
                                }}
                              >
                                {copiedKey === `import-${i}` ? "Copied!" : "Copy Link"}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        onClick={() => {
                          setShowImportModal(false);
                          resetImportModal();
                          refreshMembers();
                        }}
                        style={{
                          padding: "10px 28px",
                          background: "var(--amber)",
                          border: "1px solid var(--amber)",
                          color: "#000",
                          fontFamily: "var(--font-mono)",
                          fontSize: 12,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          cursor: "pointer",
                          borderRadius: 0,
                        }}
                      >
                        Done
                      </button>
                    </div>
                  </>
                )}
              </div>
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

          {/* Resend error */}
          {resendError && (
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
                {resendError}
              </span>
              <button
                onClick={() => setResendError(null)}
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

                    {/* Activation status */}
                    {!m.emailVerified && (
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          fontWeight: 700,
                          color: "var(--muted)",
                          background: "transparent",
                          border: "1px solid var(--border)",
                          padding: "2px 8px",
                          borderRadius: 0,
                          letterSpacing: "0.08em",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                        title="This person hasn't set up their account yet"
                      >
                        SETUP PENDING
                      </span>
                    )}

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
                      {!m.emailVerified && (
                        <button
                          onClick={() => handleCopyInviteLink(m)}
                          disabled={resendingId === m.userId}
                          title="Copy invite link"
                          style={{
                            padding: "5px 10px",
                            background: "transparent",
                            border: "1px solid var(--amber)",
                            color: "var(--amber)",
                            cursor: resendingId === m.userId ? "not-allowed" : "pointer",
                            borderRadius: 0,
                            fontSize: 11,
                            fontFamily: "var(--font-mono)",
                            fontWeight: 700,
                            letterSpacing: "0.04em",
                            whiteSpace: "nowrap",
                            opacity: resendingId === m.userId ? 0.6 : 1,
                          }}
                        >
                          {resendingId === m.userId
                            ? "…"
                            : copiedKey === m.userId
                            ? "Copied!"
                            : "Copy Invite Link"}
                        </button>
                      )}
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
              setAddedInviteUrl(null);
              setAddedMemberName("");
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
              onClick={() => {
                setShowAddModal(false);
                resetAddForm();
                setAddedInviteUrl(null);
                setAddedMemberName("");
              }}
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

            {addedMemberName ? (
              <div>
                {addedInviteUrl ? (
                  <p style={{ fontSize: 14, color: "var(--text)", margin: "0 0 12px", lineHeight: 1.5 }}>
                    <strong>{addedMemberName}</strong> has been added. We don&apos;t send this
                    automatically yet — copy the link below and send it to them (text, email,
                    whatever&apos;s easiest) so they can set up their password and log in.
                  </p>
                ) : (
                  <p style={{ fontSize: 14, color: "var(--text)", margin: "0 0 12px", lineHeight: 1.5 }}>
                    <strong>{addedMemberName}</strong> has been added. They already have a Nivarro
                    account, so no setup link is needed — or if this was a new account, its invite
                    link couldn&apos;t be generated; use &quot;Copy Invite Link&quot; from their row
                    in the roster list to try again.
                  </p>
                )}
                {addedInviteUrl && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                    <input
                      readOnly
                      value={addedInviteUrl}
                      style={{ ...inputStyle, flex: 1, fontFamily: "var(--font-mono)", fontSize: 11 }}
                      onFocus={(e) => e.target.select()}
                    />
                    <button
                      onClick={() => copyToClipboard(addedInviteUrl, "add-modal")}
                      style={{
                        padding: "8px 16px",
                        background: "var(--amber)",
                        border: "1px solid var(--amber)",
                        color: "#000",
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        cursor: "pointer",
                        borderRadius: 0,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {copiedKey === "add-modal" ? "Copied!" : "Copy Invite Link"}
                    </button>
                  </div>
                )}
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setAddedInviteUrl(null);
                    setAddedMemberName("");
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 0",
                    background: "transparent",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    borderRadius: 0,
                  }}
                >
                  Done
                </button>
              </div>
            ) : (
              <>

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
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
