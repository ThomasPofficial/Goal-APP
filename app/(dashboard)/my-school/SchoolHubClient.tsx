"use client";

import { useState } from "react";
import { GraduationCap, Briefcase, BookOpen, CheckSquare, Square, Users as UsersIcon } from "lucide-react";
import Link from "next/link";
import RequestPartnershipModal from "@/components/partnerships/RequestPartnershipModal";

interface StaffMember {
  userId: string;
  displayName: string;
  staffTitle: string | null;
  bio: string | null;
  avatarUrl: string | null;
  handle: string | null;
  industry: string | null;
}

interface Alumnus {
  id: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  bio: string | null;
  industry: string | null;
  graduationYear: number | null;
  isAvailableToMentor: boolean;
  intendedCollege: string | null;
  orgs: string[];
}

interface StudentPeer {
  id: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  graduationYear: number | null;
}

interface Props {
  schoolName: string;
  schoolTagline: string;
  staff: StaffMember[];
  alumni: Alumnus[];
  mentors: Alumnus[];
  students: StudentPeer[];
  currentUserId: string;
  otherSchools: { id: string; name: string }[];
}

function Avatar({ name, avatarUrl, handle, size = 44 }: { name: string; avatarUrl: string | null; handle?: string | null; size?: number }) {
  const content = avatarUrl ? (
    <img src={avatarUrl} alt={name} width={size} height={size} style={{ borderRadius: 0, objectFit: "cover", flexShrink: 0, display: "block" }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: 0, background: "var(--amber)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <span style={{ color: "#000", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: size * 0.4 }}>{name[0]?.toUpperCase()}</span>
    </div>
  );
  return handle ? (
    <Link href={`/profile/${handle}`} style={{ flexShrink: 0, lineHeight: 0 }} title={`View ${name}'s profile`}>
      {content}
    </Link>
  ) : content;
}

function SelectBox({ checked }: { checked: boolean }) {
  return checked ? (
    <CheckSquare size={20} style={{ color: "var(--amber)", flexShrink: 0 }} />
  ) : (
    <Square size={20} style={{ color: "var(--n-muted)", flexShrink: 0 }} />
  );
}

export default function SchoolHubClient({ schoolName, schoolTagline, staff, alumni, mentors, students, currentUserId: _, otherSchools }: Props) {
  const [alumniFilter, setAlumniFilter] = useState<"all" | "mentors">("all");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const visibleAlumni = alumniFilter === "mentors" ? alumni.filter((a) => a.isAvailableToMentor) : alumni;

  const allPeople = [
    ...staff.map((s) => ({ id: s.userId, displayName: s.displayName })),
    ...alumni.map((a) => ({ id: a.id, displayName: a.displayName })),
    ...students.map((s) => ({ id: s.id, displayName: s.displayName })),
  ];

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function cancelSelect() {
    setSelectMode(false);
    setSelected(new Set());
  }

  async function submitRequest(message: string) {
    const res = await fetch("/api/partnerships/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toUserIds: [...selected], message: message || undefined }),
    });
    if (res.ok) {
      setShowModal(false);
      setSelectMode(false);
      setSelected(new Set());
      setBanner("Partnership request sent — you'll see responses on the Partnerships page.");
    } else {
      const data = await res.json().catch(() => null);
      setBanner(data?.error ?? "Couldn't send that request. Try again.");
      setShowModal(false);
    }
  }

  return (
    <div style={{ maxWidth: 900 }}>

      {/* School banner */}
      <div style={{ padding: "32px 36px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.25em", textTransform: "uppercase", color: "var(--amber)", margin: "0 0 8px" }}>
              Private Community
            </p>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 4.5vw, 46px)", letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 8px", lineHeight: 1.05 }}>
              {schoolName}
            </h1>
            <p style={{ fontSize: 16, color: "var(--n-text2)", margin: 0 }}>{schoolTagline}</p>
            {otherSchools.length > 0 && (
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "var(--n-muted)" }}>Also at:</span>
                {otherSchools.map((s) => (
                  <a
                    key={s.id}
                    href={`/my-school?school=${s.id}`}
                    style={{
                      fontSize: 12, color: "var(--amber)", textDecoration: "underline",
                    }}
                  >
                    {s.name}
                  </a>
                ))}
              </div>
            )}
          </div>
          {selectMode ? (
            <button
              onClick={cancelSelect}
              style={{
                padding: "10px 18px", borderRadius: 0, border: "1px solid var(--border-md)",
                background: "transparent", color: "var(--n-text2)", fontFamily: "var(--font-mono)",
                fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={() => setSelectMode(true)}
              style={{
                padding: "10px 18px", borderRadius: 0, border: "1px solid var(--amber)",
                background: "var(--amber)", color: "#000", fontFamily: "var(--font-mono)",
                fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Request a Partnership
            </button>
          )}
        </div>
      </div>

      {banner && (
        <div style={{ padding: "12px 16px", border: "1px solid var(--amber)", background: "rgba(232,137,58,0.1)", color: "var(--text)", fontSize: 13, marginBottom: 20 }}>
          {banner}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
        {[
          { label: "Students", value: students.length },
          { label: "Alumni", value: alumni.length },
          { label: "Mentors", value: mentors.length },
          { label: "Staff", value: staff.length },
        ].map(({ label, value }) => (
          <div key={label} style={{ flex: "1 1 100px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, padding: "12px 18px" }}>
            <p style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 36, color: "var(--amber)", letterSpacing: "-0.04em", lineHeight: 1 }}>{value}</p>
            <p style={{ margin: "3px 0 0", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--n-muted)" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Staff */}
      {staff.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: "0 0 14px" }}>
            School Staff
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {staff.map((s) => (
              <div key={s.userId} onClick={selectMode ? () => toggleSelected(s.userId) : undefined} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, padding: "16px 18px", display: "flex", gap: 12, alignItems: "flex-start", cursor: selectMode ? "pointer" : "default" }}>
                <Avatar name={s.displayName} avatarUrl={s.avatarUrl} handle={selectMode ? null : s.handle} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 600, lineHeight: 1.35, color: "var(--text)" }}>
                    {!selectMode && s.handle ? (
                      <Link href={`/profile/${s.handle}`} style={{ color: "inherit", textDecoration: "none" }}>{s.displayName}</Link>
                    ) : s.displayName}
                  </p>
                  {s.staffTitle && (
                    <p style={{ margin: "3px 0 0", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--amber)" }}>
                      {s.staffTitle}
                    </p>
                  )}
                  {s.bio && (
                    <p style={{ margin: "7px 0 0", fontSize: 13, color: "var(--n-text2)", lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {s.bio}
                    </p>
                  )}
                </div>
                {selectMode && <SelectBox checked={selected.has(s.userId)} />}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Mentors spotlight */}
      {mentors.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: "0 0 14px" }}>
            Mentor Spotlight
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {mentors.map((m) => (
              <MentorCard key={m.id} alumnus={m} selectMode={selectMode} selected={selected.has(m.id)} onToggle={() => toggleSelected(m.id)} />
            ))}
          </div>
        </section>
      )}

      {/* Alumni network */}
      <section style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: 0 }}>
            Alumni Network
          </p>
          <div style={{ display: "flex", gap: 6 }}>
            {(["all", "mentors"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setAlumniFilter(f)}
                style={{
                  padding: "4px 12px",
                  borderRadius: 0,
                  border: alumniFilter === f ? "1px solid var(--amber)" : "1px solid var(--border)",
                  background: alumniFilter === f ? "var(--amber)" : "transparent",
                  color: alumniFilter === f ? "#000" : "var(--n-text2)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                {f === "all" ? "All" : "Mentors"}
              </button>
            ))}
          </div>
        </div>

        {visibleAlumni.length === 0 ? (
          <div style={{ padding: "32px 24px", border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 0, textAlign: "center" }}>
            <GraduationCap size={28} style={{ color: "var(--n-text2)", margin: "0 auto 10px" }} />
            <p style={{ color: "var(--n-text2)", fontSize: 14, margin: 0 }}>
              {alumniFilter === "mentors" ? "No alumni have opened mentorship yet." : "No alumni yet."}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {visibleAlumni.map((a) => (
              <AlumnusCard key={a.id} alumnus={a} selectMode={selectMode} selected={selected.has(a.id)} onToggle={() => toggleSelected(a.id)} />
            ))}
          </div>
        )}
      </section>

      {/* Students */}
      <section>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: "0 0 14px" }}>
          Students
        </p>
        {students.length === 0 ? (
          <div style={{ padding: "32px 24px", border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 0, textAlign: "center" }}>
            <UsersIcon size={28} style={{ color: "var(--n-text2)", margin: "0 auto 10px" }} />
            <p style={{ color: "var(--n-text2)", fontSize: 14, margin: 0 }}>No other students yet.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {students.map((s) => (
              <div key={s.id} onClick={selectMode ? () => toggleSelected(s.id) : undefined} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, padding: "15px 17px", display: "flex", gap: 11, alignItems: "center", cursor: selectMode ? "pointer" : "default" }}>
                <Avatar name={s.displayName} avatarUrl={s.avatarUrl} handle={selectMode ? null : s.handle} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.35, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {!selectMode && s.handle ? (
                      <Link href={`/profile/${s.handle}`} style={{ color: "inherit", textDecoration: "none" }}>{s.displayName}</Link>
                    ) : s.displayName}
                  </p>
                  {s.graduationYear && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--n-text2)", letterSpacing: "0.08em" }}>
                      Class of {s.graduationYear}
                    </span>
                  )}
                </div>
                {selectMode && <SelectBox checked={selected.has(s.id)} />}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Floating selection bar */}
      {selectMode && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40,
          background: "var(--surface)", borderTop: "1px solid var(--border)",
          padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
        }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--n-text2)" }}>
            {selected.size === 0 ? "Select people to invite" : `${selected.size} selected`}
          </p>
          <button
            onClick={() => setShowModal(true)}
            disabled={selected.size === 0}
            style={{
              padding: "10px 20px", borderRadius: 0, border: "1px solid var(--amber)",
              background: selected.size === 0 ? "rgba(232,137,58,0.3)" : "var(--amber)",
              color: "#000", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
              letterSpacing: "0.1em", textTransform: "uppercase",
              cursor: selected.size === 0 ? "not-allowed" : "pointer",
            }}
          >
            Continue
          </button>
        </div>
      )}

      {showModal && (
        <RequestPartnershipModal
          people={allPeople.filter((p) => selected.has(p.id))}
          onClose={() => setShowModal(false)}
          onSend={submitRequest}
        />
      )}
    </div>
  );
}

function MentorCard({ alumnus: a, selectMode, selected, onToggle }: { alumnus: Alumnus; selectMode: boolean; selected: boolean; onToggle: () => void }) {
  return (
    <div onClick={selectMode ? onToggle : undefined} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 11, cursor: selectMode ? "pointer" : "default" }}>
      <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
        <Avatar name={a.displayName} avatarUrl={a.avatarUrl} handle={selectMode ? null : a.handle} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, lineHeight: 1.35, color: "var(--text)" }}>
            {!selectMode && a.handle ? <Link href={`/profile/${a.handle}`} style={{ color: "inherit", textDecoration: "none" }}>{a.displayName}</Link> : a.displayName}
          </p>
          <div style={{ display: "flex", gap: 7, marginTop: 3, flexWrap: "wrap" }}>
            {a.graduationYear && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--amber)", fontWeight: 700, letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 2 }}>
                <GraduationCap size={10} /> {`'${String(a.graduationYear).slice(-2)}`}
              </span>
            )}
            {a.industry && (
              <span style={{ fontSize: 12, color: "var(--n-text2)", display: "flex", alignItems: "center", gap: 2 }}>
                <Briefcase size={10} /> {a.industry}
              </span>
            )}
          </div>
        </div>
        {selectMode ? (
          <SelectBox checked={selected} />
        ) : (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--amber)", background: "rgba(232,137,58,0.15)", padding: "2px 6px", borderRadius: 0, letterSpacing: "0.1em", whiteSpace: "nowrap" }}>
            MENTOR
          </span>
        )}
      </div>
      {a.bio && (
        <p style={{ margin: 0, fontSize: 13, color: "var(--n-text2)", lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {a.bio}
        </p>
      )}
    </div>
  );
}

function AlumnusCard({ alumnus: a, selectMode, selected, onToggle }: { alumnus: Alumnus; selectMode: boolean; selected: boolean; onToggle: () => void }) {
  return (
    <div onClick={selectMode ? onToggle : undefined} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, padding: "15px 17px", display: "flex", gap: 11, alignItems: "center", cursor: selectMode ? "pointer" : "default" }}>
      <Avatar name={a.displayName} avatarUrl={a.avatarUrl} handle={selectMode ? null : a.handle} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.35, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {!selectMode && a.handle ? <Link href={`/profile/${a.handle}`} style={{ color: "inherit", textDecoration: "none" }}>{a.displayName}</Link> : a.displayName}
        </p>
        <div style={{ display: "flex", gap: 9, marginTop: 3, flexWrap: "wrap", alignItems: "center" }}>
          {a.graduationYear && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--amber)", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 2 }}>
              <GraduationCap size={10} /> {`'${String(a.graduationYear).slice(-2)}`}
            </span>
          )}
          {a.industry && (
            <span style={{ fontSize: 12, color: "var(--n-text2)" }}>{a.industry}</span>
          )}
          {a.intendedCollege && (
            <span style={{ fontSize: 12, color: "var(--n-text2)", display: "flex", alignItems: "center", gap: 2 }}>
              <BookOpen size={10} /> {a.intendedCollege.split(" ").slice(0, 2).join(" ")}
            </span>
          )}
          {a.isAvailableToMentor && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--amber)", background: "rgba(232,137,58,0.15)", padding: "1px 5px", letterSpacing: "0.08em" }}>
              MENTOR
            </span>
          )}
        </div>
      </div>
      {selectMode && <SelectBox checked={selected} />}
    </div>
  );
}
