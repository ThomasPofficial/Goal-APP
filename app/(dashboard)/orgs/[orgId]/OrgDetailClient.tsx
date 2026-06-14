"use client";

import { useState } from "react";
import Link from "next/link";
import { format, differenceInDays, formatDistanceToNow } from "date-fns";
import { ExternalLink, Save, Users, MapPin, CheckCircle2, XCircle, Clock, Sparkles, Star } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import GeniusTypeBadge from "@/components/ui/GeniusTypeBadge";
import type { GeniusTypeKey } from "@/lib/geniusTypes";
import { cn } from "@/lib/utils";

interface OrgDetail {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  whatWeSeek: string | null;
  category: string;
  status: string;
  heroUrl: string | null;
  accentColor: string | null;
  minTeamSize: number;
  maxTeamSize: number;
  gradeEligibility: string | null;
  deadline: string | null;
  format: string | null;
  location: string | null;
  stipend: string | null;
  // Visual identity
  logoLetter: string | null;
  logoBg: string | null;
  logoColor: string | null;
  bannerGradient: string | null;
  founded: string | null;
  website: string | null;
  orgType: string | null;
  values: string;
  socialProof: string | null;
  focusTags: string;
  memberCount: number | null;
  headquartersLocation: string | null;
  whatInternsBuild: string | null;
  contactEmail: string | null;
  isPaid: boolean;
  teams: {
    id: string;
    name: string;
    status: string;
    members: {
      id: string;
      role: string;
      profile: { id: string; displayName: string; avatarUrl: string | null; geniusType: GeniusTypeKey | null; userId: string } | null;
    }[];
  }[];
}

interface OrgProjectSummary {
  id: string;
  title: string;
  description: string | null;
  shortDescription: string | null;
  openSpots: number;
  requiredSkills: string;
  preferredGeniusTypes: string;
  hoursPerWeek: string | null;
  duration: string | null;
  deadline: string | null;
  listingStatus: string;
  closedAt: string | null;
  outcomeNote: string | null;
  applicationCount: number;
}

interface AdminApplication {
  id: string;
  status: string;
  whyJoin: string | null;
  submittedAt: string;
  orgProject: { id: string; title: string };
  team: {
    id: string;
    name: string;
    members: {
      id: string;
      role: string;
      profile: {
        id: string;
        displayName: string;
        avatarUrl: string | null;
        geniusType: GeniusTypeKey | null;
        handle: string | null;
        headline: string | null;
        bio: string | null;
        strengthSummary: string | null;
        orgReviews: { id: string; body: string; org: { name: string }; orgProject: { title: string } }[];
      } | null;
    }[];
  };
}

const CATEGORY_COLORS: Record<string, string> = {
  ACCELERATOR: "#F59E0B", FELLOWSHIP: "#6366F1", INTERNSHIP: "#14B8A6",
  COMPETITION: "#F97316", BOOTCAMP: "#8B5CF6", RESEARCH: "#06B6D4", CLUB: "#10B981",
};

function GenerateKeyButton({ orgId, onGenerated }: { orgId: string; onGenerated: (key: string) => void }) {
  const [loading, setLoading] = useState(false);
  const generate = async () => {
    setLoading(true);
    const res = await fetch(`/api/orgs/${orgId}/generate-api-key`, { method: "POST" });
    const data = await res.json();
    if (res.ok) onGenerated(data.apiKey);
    setLoading(false);
  };
  return (
    <button
      onClick={generate}
      disabled={loading}
      className="text-xs px-3 py-1.5 rounded-lg"
      style={{ background: "rgba(74,128,240,0.15)", color: "var(--blue)", border: "1px solid rgba(74,128,240,0.3)" }}
    >
      {loading ? "Generating…" : "Generate API Key"}
    </button>
  );
}

function CloseProjectModal({
  project,
  orgId,
  onClose,
  onClosed,
}: {
  project: OrgProjectSummary;
  orgId: string;
  onClose: () => void;
  onClosed: (projectId: string, outcomeNote: string) => void;
}) {
  const [outcomeNote, setOutcomeNote] = useState("");
  const [loading, setLoading] = useState(false);

  const handleClose = async () => {
    setLoading(true);
    const res = await fetch(`/api/org-projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CLOSED", outcomeNote }),
    });
    if (res.ok) {
      onClosed(project.id, outcomeNote);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="rounded-2xl p-6 w-full max-w-md" style={{ background: "var(--bg)", border: "1px solid var(--border-md)" }}>
        <h2 className="text-base font-semibold mb-1" style={{ color: "var(--text)", fontFamily: "var(--font-serif)" }}>
          Close project
        </h2>
        <p className="text-sm mb-4" style={{ color: "var(--text2)" }}>{project.title}</p>
        <label className="block mb-1">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
            What did this team build? (optional)
          </span>
        </label>
        <textarea
          value={outcomeNote}
          onChange={(e) => setOutcomeNote(e.target.value)}
          rows={3}
          className="w-full rounded-lg px-3 py-2 text-sm mb-4 resize-none"
          style={{ background: "var(--surface)", border: "1px solid var(--border-md)", color: "var(--text)", outline: "none" }}
          placeholder="Briefly describe the outcome…"
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-lg"
            style={{ background: "var(--surface)", color: "var(--text2)", border: "1px solid var(--border-md)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-sm px-4 py-2 rounded-lg font-semibold"
            style={{ background: "rgba(248,113,113,0.12)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }}
          >
            {loading ? "Closing…" : "Close Project"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OrgDetailClient({
  org, projects, myProfileId, myTeamId, isAdmin, applications,
  adminStats, apiKey, reviewCount, whatInternsBuild, initialSaved,
}: {
  org: OrgDetail;
  projects: OrgProjectSummary[];
  myProfileId: string | null;
  myTeamId: string | null;
  isAdmin: boolean;
  applications: AdminApplication[];
  adminStats: { activeProjects: number; totalApps: number; pendingCount: number; acceptedCount: number } | null;
  apiKey: string | null;
  reviewCount: number;
  whatInternsBuild: string | null;
  initialSaved: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [adminTab, setAdminTab] = useState<"overview" | "projects" | "applications" | "settings">("overview");
  const [appStatuses, setAppStatuses] = useState<Record<string, string>>(
    () => Object.fromEntries(applications.map((a) => [a.id, a.status]))
  );
  const [closingProject, setClosingProject] = useState<string | null>(null);
  const [apiKeyState, setApiKeyState] = useState<string | null>(apiKey);
  const [projectStatuses, setProjectStatuses] = useState<Record<string, string>>(
    () => Object.fromEntries(projects.map((p) => [p.id, p.listingStatus]))
  );
  const [projectOutcomeNotes, setProjectOutcomeNotes] = useState<Record<string, string>>(
    () => Object.fromEntries(projects.map((p) => [p.id, p.outcomeNote ?? ""]))
  );

  const accentColor = org.accentColor ?? CATEGORY_COLORS[org.category] ?? "#1060d8";
  const daysLeft = org.deadline ? differenceInDays(new Date(org.deadline), new Date()) : null;
  const values: string[] = JSON.parse(org.values || "[]");
  const focusTags: string[] = JSON.parse(org.focusTags || "[]");

  const bannerBg = org.heroUrl
    ? `url(${org.heroUrl}) center/cover`
    : org.bannerGradient
    ? org.bannerGradient
    : `linear-gradient(135deg, ${accentColor}30 0%, #030609 100%)`;

  // Projects with locally-updated statuses
  const projectsWithStatus = projects.map((p) => ({
    ...p,
    listingStatus: projectStatuses[p.id] ?? p.listingStatus,
    outcomeNote: projectOutcomeNotes[p.id] ?? p.outcomeNote,
  }));

  const openProjects = projectsWithStatus.filter((p) => p.listingStatus === "OPEN");
  const closedProjects = projectsWithStatus.filter((p) => p.closedAt || p.listingStatus === "CLOSED");

  return (
    <div>
      {/* Hero banner */}
      <div
        className="h-44 rounded-xl mb-0 relative overflow-hidden"
        style={{ background: bannerBg }}
      >
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 40%, rgba(3,6,9,0.85) 100%)" }} />
      </div>

      {/* Org identity row */}
      <div className="flex items-end gap-4 px-1 -mt-8 mb-6 relative z-10">
        <div
          className="w-16 h-16 rounded-xl border-4 flex items-center justify-center text-2xl font-bold flex-shrink-0"
          style={{
            background: org.logoBg ?? accentColor,
            color: org.logoColor ?? "#fff",
            borderColor: "#030609",
            fontFamily: "var(--font-serif)",
          }}
        >
          {org.logoLetter ?? org.name[0]}
        </div>
        <div className="pb-1">
          <p
            className="font-semibold text-xl"
            style={{ color: "var(--text)", fontFamily: "var(--font-serif)" }}
          >
            {org.name}
          </p>
          {org.tagline && <p className="text-sm" style={{ color: "var(--text2)" }}>{org.tagline}</p>}
          <div className="flex flex-wrap gap-1.5 mt-1">
            {focusTags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(59,130,246,0.1)", border: "1px solid var(--border-md)", color: "var(--blue)" }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Admin tab switcher */}
      {isAdmin && (
        <div className="overflow-x-auto -mx-1 mb-5">
          <div className="flex gap-1 border-b px-1" style={{ borderColor: "var(--border)", minWidth: "max-content" }}>
            {(["overview", "projects", "applications", "settings"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setAdminTab(t)}
                className="pb-2.5 px-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize whitespace-nowrap"
                style={{
                  borderBottomColor: adminTab === t ? "var(--blue)" : "transparent",
                  color: adminTab === t ? "var(--text)" : "var(--text2)",
                }}
              >
                {t === "applications"
                  ? `Applications${applications.length ? ` (${applications.length})` : ""}`
                  : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Admin: applications review panel */}
      {isAdmin && adminTab === "applications" && (
        <AdminApplicationsPanel
          orgId={org.id}
          applications={applications}
          statuses={appStatuses}
          onDecision={(id, status) => setAppStatuses((prev) => ({ ...prev, [id]: status }))}
        />
      )}

      {/* Admin: projects tab */}
      {isAdmin && adminTab === "projects" && (
        <div className="space-y-3 mb-6">
          {projectsWithStatus.map((proj) => (
            <div
              key={proj.id}
              className="rounded-xl p-4 flex items-center justify-between gap-4"
              style={{ background: "var(--surface)", border: "1px solid var(--border-md)" }}
            >
              <div className="flex-1 min-w-0">
                <Link
                  href={`/orgs/${org.id}/projects/${proj.id}`}
                  className="font-medium text-sm hover:underline"
                  style={{ color: "var(--text)" }}
                >
                  {proj.title}
                </Link>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                  {proj.applicationCount} application{proj.applicationCount !== 1 ? "s" : ""} · {proj.openSpots} open spot{proj.openSpots !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                    proj.listingStatus === "OPEN" ? "bg-green-950 text-green-400" : "bg-[#1e1e24] text-[#9898a8]"
                  }`}
                >
                  {proj.listingStatus}
                </span>
                {proj.listingStatus === "OPEN" && (
                  <button
                    onClick={() => setClosingProject(proj.id)}
                    className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ background: "rgba(248,113,113,0.08)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          ))}
          {projects.length === 0 && (
            <div className="py-12 text-center" style={{ color: "var(--muted)" }}>No projects yet.</div>
          )}
        </div>
      )}

      {/* Admin: settings tab */}
      {isAdmin && adminTab === "settings" && (
        <div
          className="rounded-xl p-5 space-y-4 mb-6"
          style={{ background: "var(--surface)", border: "1px solid var(--border-md)" }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>Org Name</p>
            <p className="text-sm" style={{ color: "var(--text)" }}>{org.name}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>Description</p>
            <p className="text-sm" style={{ color: "var(--text2)" }}>{org.description || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>Contact Email</p>
            <p className="text-sm" style={{ color: "var(--text2)" }}>{org.contactEmail || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>What Interns Build</p>
            <p className="text-sm" style={{ color: "var(--text2)" }}>{org.whatInternsBuild || "—"}</p>
          </div>
        </div>
      )}

      <div
        className={cn(
          "flex gap-6",
          isAdmin && (adminTab === "applications" || adminTab === "projects" || adminTab === "settings") && "hidden"
        )}
      >
        {/* ── Left content ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* Admin overview stats strip */}
          {isAdmin && adminStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Active Projects", value: adminStats.activeProjects },
                { label: "Applications", value: adminStats.totalApps },
                { label: "Pending Review", value: adminStats.pendingCount },
                { label: "Teams Accepted", value: adminStats.acceptedCount },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-xl p-4 text-center"
                  style={{ background: "var(--surface)", border: "1px solid var(--border-md)" }}
                >
                  <p className="text-2xl font-bold" style={{ color: "var(--text)", fontFamily: "var(--font-serif)" }}>{value}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Admin: API key widget */}
          {isAdmin && (
            <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border-md)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>API Key</p>
              {apiKeyState ? (
                <div className="flex items-center gap-2">
                  <code
                    className="flex-1 text-sm px-3 py-1.5 rounded-lg"
                    style={{ background: "var(--n-bg2)", color: "var(--text2)", fontFamily: "var(--font-mono)", border: "1px solid var(--border)" }}
                  >
                    nv_sk_{"•".repeat(24)}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(apiKeyState)}
                    className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ background: "rgba(74,128,240,0.15)", color: "var(--blue)", border: "1px solid rgba(74,128,240,0.3)" }}
                  >
                    Copy
                  </button>
                </div>
              ) : (
                <GenerateKeyButton orgId={org.id} onGenerated={(key) => setApiKeyState(key)} />
              )}
              <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
                Your API key gives AI agents access to student profiles and private org reviews.{" "}
                <a href="/docs/api" style={{ color: "var(--blue)" }}>View docs →</a>
              </p>
            </div>
          )}

          {org.socialProof && (
            <div
              className="rounded-lg px-4 py-3 text-sm italic"
              style={{
                background: "rgba(16,96,216,0.06)",
                border: "1px solid var(--border-md)",
                color: "var(--text2)",
                fontFamily: "var(--font-serif)",
                fontSize: 15,
              }}
            >
              {org.socialProof}
            </div>
          )}

          {org.description && (
            <div>
              <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>About</h2>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text2)" }}>{org.description}</p>
            </div>
          )}

          {/* What students work on (public) */}
          {(whatInternsBuild ?? org.whatInternsBuild) && (
            <div>
              <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>What students work on</h2>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text2)" }}>{whatInternsBuild ?? org.whatInternsBuild}</p>
            </div>
          )}

          {values.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>Values</h2>
              <div className="flex flex-wrap gap-1.5">
                {values.map((v) => (
                  <span key={v} className="text-xs px-2.5 py-1 rounded-full" style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)" }}>
                    {v}
                  </span>
                ))}
              </div>
            </div>
          )}

          {org.whatWeSeek && (
            <div className="border-l-4 pl-4 py-2" style={{ borderColor: accentColor }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted)" }}>What we&apos;re looking for</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text2)" }}>{org.whatWeSeek}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm" style={{ color: "var(--text2)" }}>
            {org.orgType && <div><span style={{ color: "var(--muted)" }}>Type: </span>{org.orgType}</div>}
            {org.founded && <div><span style={{ color: "var(--muted)" }}>Founded: </span>{org.founded}</div>}
            {org.memberCount && <div><span style={{ color: "var(--muted)" }}>Members: </span>{org.memberCount.toLocaleString()}</div>}
            {org.headquartersLocation && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--muted)" }} />
                {org.headquartersLocation}
              </div>
            )}
            {org.format && <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--muted)" }} />{org.format}</div>}
            {org.location && <div style={{ color: "var(--text2)" }}>{org.location}</div>}
            {org.stipend && <div><span style={{ color: "var(--muted)" }}>Stipend: </span>{org.stipend}</div>}
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--muted)" }} />
              Team size: <span className="font-medium">{org.minTeamSize}–{org.maxTeamSize}</span>
            </div>
            {org.website && (
              <div>
                <a href={`https://${org.website.replace(/^https?:\/\//, "")}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:underline" style={{ color: "var(--blue)" }}>
                  <ExternalLink className="w-3.5 h-3.5" /> {org.website}
                </a>
              </div>
            )}
          </div>

          {/* Trust signals */}
          {reviewCount > 0 && (
            <div className="flex gap-4 flex-wrap">
              <div
                className="text-xs px-3 py-1.5 rounded-full"
                style={{ background: "rgba(74,128,240,0.08)", border: "1px solid var(--border-md)", color: "var(--text2)" }}
              >
                ✓ {reviewCount} student{reviewCount !== 1 ? "s" : ""} reviewed
              </div>
            </div>
          )}

          {openProjects.length > 0 && (
            <div id="projects">
              <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text)" }}>Open Projects</h2>
              <div className="space-y-2">
                {openProjects.map((proj) => {
                  const skills: string[] = JSON.parse(proj.requiredSkills || "[]");
                  const preferred: string[] = JSON.parse(proj.preferredGeniusTypes || "[]");
                  return (
                    <Link
                      key={proj.id}
                      href={`/orgs/${org.id}/projects/${proj.id}`}
                      className="block rounded-lg p-3 transition-colors group"
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--border-md)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p
                            className="font-medium text-sm group-hover:text-[#4a80f0] transition-colors"
                            style={{ color: "var(--text)", fontFamily: "var(--font-serif)", fontSize: 15 }}
                          >
                            {proj.title}
                          </p>
                          {(proj.shortDescription ?? proj.description) && (
                            <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--text2)" }}>
                              {proj.shortDescription ?? proj.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {proj.hoursPerWeek && <span className="text-[10px]" style={{ color: "var(--muted)" }}>⏱ {proj.hoursPerWeek}</span>}
                            {proj.duration && <span className="text-[10px]" style={{ color: "var(--muted)" }}>📅 {proj.duration}</span>}
                          </div>
                          {skills.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {skills.slice(0, 4).map((s) => (
                                <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)" }}>{s}</span>
                              ))}
                            </div>
                          )}
                          {preferred.length > 0 && (
                            <div className="flex items-center gap-1 mt-1.5">
                              {preferred.map((t) => <GeniusTypeBadge key={t} type={t as GeniusTypeKey} size="sm" />)}
                            </div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-semibold" style={{ color: accentColor }}>{proj.openSpots}</p>
                          <p className="text-[10px]" style={{ color: "var(--muted)" }}>open spots</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Past projects */}
          {closedProjects.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text)" }}>Past Projects</h2>
              <div className="space-y-2">
                {closedProjects.map((proj) => (
                  <div
                    key={proj.id}
                    className="rounded-lg p-3"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                  >
                    <p className="font-medium text-sm" style={{ color: "var(--text2)" }}>{proj.title}</p>
                    {proj.outcomeNote && (
                      <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{proj.outcomeNote}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* ── Right sidebar ─────────────────────────────────────── */}
        <div className="w-64 flex-shrink-0 space-y-4">
          <div className="rounded-xl p-4 sticky top-6" style={{ background: "var(--surface)", border: "1px solid var(--border-md)", boxShadow: "var(--glow-card)" }}>
            {org.deadline && (
              <div className="text-center mb-4">
                <p className="text-2xl font-bold" style={{ color: "var(--text)" }}>{Math.max(0, daysLeft ?? 0)}</p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>days remaining</p>
                <p className="text-xs mt-1" style={{ color: "var(--text2)" }}>
                  Deadline: {format(new Date(org.deadline), "MMM d, yyyy")}
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 mb-4">
              <span
                className={cn(
                  "flex-1 text-center text-xs font-semibold py-1 rounded-full",
                  org.status === "OPEN" ? "bg-green-950 text-green-400" :
                  org.status === "ROLLING" ? "bg-blue-950 text-blue-400" :
                  "bg-[#1e1e24] text-[#9898a8]"
                )}
              >
                {org.status}
              </span>
            </div>

            {myTeamId ? (
              <Link
                href={`/teams/${myTeamId}`}
                className="btn-primary flex items-center justify-center gap-1 w-full py-2.5 text-sm"
              >
                Open workspace <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            ) : openProjects.length > 0 ? (
              <a
                href="#projects"
                className="btn-primary w-full py-2.5 text-sm text-center block"
              >
                View open projects ↓
              </a>
            ) : (
              <p className="text-xs text-center py-2" style={{ color: "var(--muted)" }}>
                No open projects yet.
              </p>
            )}

            <button
              onClick={async () => {
                const res = await fetch(`/api/orgs/${org.id}/save`, { method: "POST" });
                const data = await res.json();
                setSaved(data.saved);
              }}
              className={cn(
                "flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border text-xs font-medium mt-2 transition-colors",
                saved
                  ? "border-[#4a80f0] text-[#4a80f0]"
                  : "text-[#9898a8] hover:text-[#4a80f0]"
              )}
            >
              <Save className="w-3.5 h-3.5" fill={saved ? "currentColor" : "none"} />
              {saved ? "Saved" : "Save"}
            </button>
          </div>
        </div>
      </div>

      {/* Close project modal */}
      {closingProject && (
        <CloseProjectModal
          project={projectsWithStatus.find((p) => p.id === closingProject)!}
          orgId={org.id}
          onClose={() => setClosingProject(null)}
          onClosed={(projectId, note) => {
            setProjectStatuses((prev) => ({ ...prev, [projectId]: "CLOSED" }));
            setProjectOutcomeNotes((prev) => ({ ...prev, [projectId]: note }));
            setClosingProject(null);
          }}
        />
      )}
    </div>
  );
}

function WriteReviewModal({
  app,
  onClose,
  onSubmitted,
}: {
  app: AdminApplication;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const members = app.team.members.filter((m) => m.profile);
  const [selectedProfileId, setSelectedProfileId] = useState(members[0]?.profile?.id ?? "");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (body.trim().length < 50) {
      setError("Review must be at least 50 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/org-projects/${app.orgProject.id}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviews: [{ profileId: selectedProfileId, body: body.trim() }] }),
    });
    if (res.ok) {
      onSubmitted();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to submit review.");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="rounded-2xl p-6 w-full max-w-md" style={{ background: "var(--bg)", border: "1px solid var(--border-md)" }}>
        <h2 className="text-base font-semibold mb-1" style={{ color: "var(--text)", fontFamily: "var(--font-serif)" }}>
          Write review
        </h2>
        <p className="text-sm mb-4" style={{ color: "var(--text2)" }}>{app.orgProject.title} · {app.team.name}</p>

        {members.length > 1 ? (
          <div className="mb-4">
            <label className="block mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                Student
              </span>
            </label>
            <select
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: "var(--surface)", border: "1px solid var(--border-md)", color: "var(--text)", outline: "none" }}
            >
              {members.map((m) => (
                <option key={m.profile!.id} value={m.profile!.id}>
                  {m.profile!.displayName}
                </option>
              ))}
            </select>
          </div>
        ) : members.length === 1 ? (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <Avatar src={members[0].profile!.avatarUrl} name={members[0].profile!.displayName} geniusType={members[0].profile!.geniusType} size={24} />
            <span className="text-sm" style={{ color: "var(--text)" }}>{members[0].profile!.displayName}</span>
          </div>
        ) : null}

        <label className="block mb-1">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
            Review
          </span>
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          className="w-full rounded-lg px-3 py-2 text-sm mb-1 resize-none"
          style={{ background: "var(--surface)", border: "1px solid var(--border-md)", color: "var(--text)", outline: "none" }}
          placeholder="Describe the student's contributions, growth, and strengths…"
        />
        <p className="text-xs mb-4" style={{ color: body.trim().length >= 50 ? "var(--muted)" : "#f87171" }}>
          {body.trim().length} / 50 min
        </p>

        {error && (
          <div className="mb-4 text-sm rounded-lg px-3 py-2" style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171" }}>
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-lg"
            style={{ background: "var(--surface)", color: "var(--text2)", border: "1px solid var(--border-md)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || body.trim().length < 50 || !selectedProfileId}
            className="text-sm px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
            style={{ background: "rgba(74,128,240,0.15)", color: "var(--blue)", border: "1px solid rgba(74,128,240,0.3)" }}
          >
            {loading ? "Submitting…" : "Submit Review"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminApplicationsPanel({
  orgId, applications, statuses, onDecision,
}: {
  orgId: string;
  applications: AdminApplication[];
  statuses: Record<string, string>;
  onDecision: (id: string, status: string) => void;
}) {
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [reviewingApp, setReviewingApp] = useState<AdminApplication | null>(null);
  const [submittedReviews, setSubmittedReviews] = useState<Set<string>>(new Set());

  const decide = async (id: string, status: "ACCEPTED" | "REJECTED") => {
    onDecision(id, status);
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) onDecision(id, "PENDING");
    } catch {
      onDecision(id, "PENDING");
    }
  };

  const analyzeWithAI = async () => {
    setAiLoading(true);
    setAiAnalysis(null);
    setAiError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/analyze-applicants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) setAiAnalysis(data.analysis || "No analysis returned.");
      else setAiError(data.error ?? "Analysis failed. Please try again.");
    } catch {
      setAiError("Network error. Please try again.");
    } finally {
      setAiLoading(false);
    }
  };

  if (applications.length === 0) {
    return (
      <div className="text-center py-16 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <Clock className="w-7 h-7 mx-auto mb-3" style={{ color: "var(--muted)" }} />
        <p className="text-sm font-medium" style={{ color: "var(--text2)" }}>No applications yet</p>
        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>Applications from teams will appear here</p>
      </div>
    );
  }

  const pending = applications.filter((a) => statuses[a.id] === "PENDING");
  const decided = applications.filter((a) => statuses[a.id] !== "PENDING");

  return (
    <div className="space-y-6 mb-6">
      {/* AI analysis button */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
          {applications.length} application{applications.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={analyzeWithAI}
          disabled={aiLoading}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          style={{
            background: aiLoading ? "rgba(139,92,246,0.06)" : "rgba(139,92,246,0.12)",
            color: "#a78bfa",
            border: "1px solid rgba(139,92,246,0.25)",
            opacity: aiLoading ? 0.7 : 1,
          }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          {aiLoading ? "Analyzing…" : "Analyze with AI"}
        </button>
      </div>

      {/* AI error */}
      {aiError && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171" }}>
          {aiError}
        </div>
      )}

      {/* AI analysis result */}
      {aiAnalysis && (
        <div className="rounded-xl p-4 relative" style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.2)" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" style={{ color: "#a78bfa" }} />
              <span className="text-xs font-semibold" style={{ color: "#a78bfa", fontFamily: "var(--font-mono, monospace)" }}>AI ANALYSIS</span>
            </div>
            <button
              onClick={() => setAiAnalysis(null)}
              className="text-xs px-2 py-0.5 rounded"
              style={{ color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}
            >
              ✕
            </button>
          </div>
          <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words overflow-x-auto" style={{ color: "var(--text2)", fontFamily: "var(--font-mono, monospace)", overflowWrap: "break-word" }}>
            {aiAnalysis}
          </pre>
        </div>
      )}

      {pending.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text2)", fontFamily: "var(--font-mono, monospace)" }}>
            Pending · {pending.length}
          </p>
          <div className="space-y-3">
            {pending.map((app) => (
              <ApplicationCard key={app.id} app={app} status={statuses[app.id]} onDecide={decide} onWriteReview={null} />
            ))}
          </div>
        </div>
      )}
      {decided.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text2)", fontFamily: "var(--font-mono, monospace)" }}>
            Decided · {decided.length}
          </p>
          <div className="space-y-3">
            {decided.map((app) => (
              <ApplicationCard
                key={app.id}
                app={app}
                status={statuses[app.id]}
                onDecide={decide}
                onWriteReview={statuses[app.id] === "ACCEPTED" ? () => setReviewingApp(app) : null}
                reviewSubmitted={submittedReviews.has(app.id)}
              />
            ))}
          </div>
        </div>
      )}

      {reviewingApp && (
        <WriteReviewModal
          app={reviewingApp}
          onClose={() => setReviewingApp(null)}
          onSubmitted={() => {
            setSubmittedReviews((prev) => new Set(prev).add(reviewingApp.id));
            setReviewingApp(null);
          }}
        />
      )}
    </div>
  );
}

function ApplicationCard({
  app, status, onDecide, onWriteReview, reviewSubmitted,
}: {
  app: AdminApplication;
  status: string;
  onDecide: (id: string, s: "ACCEPTED" | "REJECTED") => void;
  onWriteReview: (() => void) | null;
  reviewSubmitted?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "var(--surface)",
        border: `1px solid ${status === "ACCEPTED" ? "rgba(74,222,128,0.25)" : status === "REJECTED" ? "rgba(248,113,113,0.2)" : "var(--border-md)"}`,
        opacity: status !== "PENDING" ? 0.75 : 1,
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <Link href={`/teams/${app.team.id}`} className="font-semibold text-sm hover:underline" style={{ color: "var(--text)" }}>
          {app.team.name}
        </Link>
        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(74,128,240,0.1)", color: "var(--blue)", fontFamily: "var(--font-mono, monospace)" }}>
          {app.orgProject.title}
        </span>
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {formatDistanceToNow(new Date(app.submittedAt), { addSuffix: true })}
        </span>
        {status !== "PENDING" && (
          <span
            className="text-xs font-semibold px-2.5 py-0.5 rounded-full ml-auto"
            style={{
              background: status === "ACCEPTED" ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.08)",
              color: status === "ACCEPTED" ? "#4ade80" : "#f87171",
            }}
          >
            {status === "ACCEPTED" ? "Accepted" : "Rejected"}
          </span>
        )}
      </div>

      {/* Why join */}
      {app.whyJoin && (
        <p
          className="text-xs italic mb-3 pl-3 border-l-2"
          style={{ color: "var(--text2)", borderColor: "var(--border-md)", lineHeight: 1.6 }}
        >
          &ldquo;{app.whyJoin}&rdquo;
        </p>
      )}

      {/* Team members — rich cards */}
      <div className="space-y-3">
        {app.team.members.map((m) => {
          if (!m.profile) return null;
          const p = m.profile;
          return (
            <div key={m.id} className="rounded-lg p-3" style={{ background: "var(--n-bg2)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 flex-wrap">
                <Avatar src={p.avatarUrl} name={p.displayName} geniusType={p.geniusType} size={26} />
                {p.handle ? (
                  <Link href={`/peers/${p.handle}`} className="text-sm font-medium hover:underline" style={{ color: "var(--text)" }}>
                    {p.displayName}
                  </Link>
                ) : (
                  <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{p.displayName}</span>
                )}
                {p.geniusType && <GeniusTypeBadge type={p.geniusType} size="sm" />}
              </div>
              {p.headline && (
                <p className="text-xs mt-1.5 ml-8" style={{ color: "var(--text2)" }}>{p.headline}</p>
              )}
              {p.orgReviews.length > 0 && (
                <div className="mt-2 ml-8 space-y-1.5">
                  {p.orgReviews.slice(0, 2).map((r) => (
                    <div key={r.id} className="text-xs rounded p-2" style={{ background: "rgba(74,128,240,0.06)", border: "1px solid var(--border)" }}>
                      <span className="font-semibold" style={{ color: "var(--text2)" }}>
                        <Star className="w-3 h-3 inline mr-0.5 mb-px" style={{ color: "#f59e0b" }} />
                        {r.org.name} — {r.orgProject.title}
                      </span>
                      <p className="mt-0.5" style={{ color: "var(--muted)" }}>
                        &ldquo;{r.body.length > 100 ? r.body.slice(0, 100) + "…" : r.body}&rdquo;
                      </p>
                    </div>
                  ))}
                  {p.orgReviews.length > 2 && (
                    <p className="text-xs" style={{ color: "var(--muted)" }}>+{p.orgReviews.length - 2} more review{p.orgReviews.length - 2 !== 1 ? "s" : ""}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Accept / Reject — full-width at the bottom, easy thumb targets */}
      {status === "PENDING" && (
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => onDecide(app.id, "ACCEPTED")}
            className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold py-2.5 rounded-lg transition-colors"
            style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.25)" }}
          >
            <CheckCircle2 className="w-4 h-4" /> Accept
          </button>
          <button
            onClick={() => onDecide(app.id, "REJECTED")}
            className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold py-2.5 rounded-lg transition-colors"
            style={{ background: "rgba(248,113,113,0.08)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}
          >
            <XCircle className="w-4 h-4" /> Reject
          </button>
        </div>
      )}

      {/* Write review — only for accepted apps */}
      {onWriteReview && (
        <div className="mt-3">
          {reviewSubmitted ? (
            <p className="text-xs text-center py-2" style={{ color: "#4ade80" }}>
              ✓ Review submitted
            </p>
          ) : (
            <button
              onClick={onWriteReview}
              className="w-full text-sm py-2 rounded-lg font-medium"
              style={{ background: "rgba(74,128,240,0.08)", color: "var(--blue)", border: "1px solid rgba(74,128,240,0.2)" }}
            >
              Write Review
            </button>
          )}
        </div>
      )}
    </div>
  );
}
