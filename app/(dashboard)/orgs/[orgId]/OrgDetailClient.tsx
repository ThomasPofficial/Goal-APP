"use client";

import { useState } from "react";
import Link from "next/link";
import { format, differenceInDays, formatDistanceToNow } from "date-fns";
import { ExternalLink, Save, Users, MapPin, CheckCircle2, XCircle, Clock } from "lucide-react";
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
  opportunities: { id: string; title: string; description: string | null; deadline: string | null }[];
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
  status: string;
}

interface AdminApplication {
  id: string;
  status: string;
  submittedAt: string;
  orgProject: { id: string; title: string };
  team: {
    id: string;
    name: string;
    members: {
      id: string;
      role: string;
      profile: { id: string; displayName: string; avatarUrl: string | null; geniusType: GeniusTypeKey | null; handle: string | null } | null;
    }[];
  };
}

const CATEGORY_COLORS: Record<string, string> = {
  ACCELERATOR: "#F59E0B", FELLOWSHIP: "#6366F1", INTERNSHIP: "#14B8A6",
  COMPETITION: "#F97316", BOOTCAMP: "#8B5CF6", RESEARCH: "#06B6D4", CLUB: "#10B981",
};

export default function OrgDetailClient({
  org, projects, myProfileId, myTeamId, isAdmin, applications,
}: {
  org: OrgDetail; projects: OrgProjectSummary[]; myProfileId: string | null; myTeamId: string | null;
  isAdmin: boolean; applications: AdminApplication[];
}) {
  const [saved, setSaved] = useState(false);
  const [adminTab, setAdminTab] = useState<"overview" | "applications">("overview");
  const [appStatuses, setAppStatuses] = useState<Record<string, string>>(
    () => Object.fromEntries(applications.map((a) => [a.id, a.status]))
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
            fontFamily: "'Cormorant Garamond', serif",
          }}
        >
          {org.logoLetter ?? org.name[0]}
        </div>
        <div className="pb-1">
          <p
            className="font-semibold text-xl"
            style={{ color: "#f0f8ff", fontFamily: "'Cormorant Garamond', serif" }}
          >
            {org.name}
          </p>
          {org.tagline && <p className="text-sm" style={{ color: "#8ab0d8" }}>{org.tagline}</p>}
          <div className="flex flex-wrap gap-1.5 mt-1">
            {focusTags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(16,96,216,0.12)", border: "1px solid rgba(16,96,216,0.25)", color: "#6A9FFF" }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Admin tab switcher */}
      {isAdmin && (
        <div className="flex gap-1 mb-5 border-b" style={{ borderColor: "var(--border)" }}>
          {(["overview", "applications"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setAdminTab(t)}
              className="pb-2.5 px-1 text-sm font-medium border-b-2 -mb-px transition-colors capitalize"
              style={{
                borderBottomColor: adminTab === t ? "var(--blue)" : "transparent",
                color: adminTab === t ? "var(--text)" : "var(--text2)",
              }}
            >
              {t === "applications" ? `Applications${applications.length ? ` (${applications.length})` : ""}` : "Overview"}
            </button>
          ))}
        </div>
      )}

      {/* Admin: applications review panel */}
      {isAdmin && adminTab === "applications" && (
        <AdminApplicationsPanel
          applications={applications}
          statuses={appStatuses}
          onDecision={(id, status) => setAppStatuses((prev) => ({ ...prev, [id]: status }))}
        />
      )}

      <div className={cn("flex gap-6", isAdmin && adminTab === "applications" && "hidden")}>
        {/* ── Left content ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-6">
          {org.socialProof && (
            <div
              className="rounded-lg px-4 py-3 text-sm italic"
              style={{
                background: "rgba(16,96,216,0.06)",
                border: "1px solid rgba(16,96,216,0.18)",
                color: "#8ab0d8",
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 15,
              }}
            >
              {org.socialProof}
            </div>
          )}

          {org.description && (
            <div>
              <h2 className="text-sm font-semibold mb-2" style={{ color: "#d8eeff" }}>About</h2>
              <p className="text-sm leading-relaxed" style={{ color: "#8ab0d8" }}>{org.description}</p>
            </div>
          )}

          {values.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-2" style={{ color: "#d8eeff" }}>Values</h2>
              <div className="flex flex-wrap gap-1.5">
                {values.map((v) => (
                  <span key={v} className="text-xs px-2.5 py-1 rounded-full" style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "#8ab0d8" }}>
                    {v}
                  </span>
                ))}
              </div>
            </div>
          )}

          {org.whatWeSeek && (
            <div className="border-l-4 pl-4 py-2" style={{ borderColor: accentColor }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#5a7898" }}>What we&apos;re looking for</h3>
              <p className="text-sm leading-relaxed" style={{ color: "#8ab0d8" }}>{org.whatWeSeek}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm" style={{ color: "#8ab0d8" }}>
            {org.orgType && <div><span style={{ color: "#5a7898" }}>Type: </span>{org.orgType}</div>}
            {org.founded && <div><span style={{ color: "#5a7898" }}>Founded: </span>{org.founded}</div>}
            {org.memberCount && <div><span style={{ color: "#5a7898" }}>Members: </span>{org.memberCount.toLocaleString()}</div>}
            {org.headquartersLocation && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#5a7898" }} />
                {org.headquartersLocation}
              </div>
            )}
            {org.format && <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#5a7898" }} />{org.format}</div>}
            {org.location && <div style={{ color: "#8ab0d8" }}>{org.location}</div>}
            {org.stipend && <div><span style={{ color: "#5a7898" }}>Stipend: </span>{org.stipend}</div>}
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#5a7898" }} />
              Team size: <span className="font-medium">{org.minTeamSize}–{org.maxTeamSize}</span>
            </div>
            {org.website && (
              <div>
                <a href={`https://${org.website.replace(/^https?:\/\//, "")}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:underline" style={{ color: "#4a80f0" }}>
                  <ExternalLink className="w-3.5 h-3.5" /> {org.website}
                </a>
              </div>
            )}
          </div>

          {projects.length > 0 && (
            <div id="projects">
              <h2 className="text-sm font-semibold text-[#e8e8ec] mb-3">Open Projects</h2>
              <div className="space-y-2">
                {projects.map((proj) => {
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
                            style={{ color: "#d8eeff", fontFamily: "'Cormorant Garamond', serif", fontSize: 15 }}
                          >
                            {proj.title}
                          </p>
                          {(proj.shortDescription ?? proj.description) && (
                            <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "#8ab0d8" }}>
                              {proj.shortDescription ?? proj.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {proj.hoursPerWeek && <span className="text-[10px]" style={{ color: "#5a7898" }}>⏱ {proj.hoursPerWeek}</span>}
                            {proj.duration && <span className="text-[10px]" style={{ color: "#5a7898" }}>📅 {proj.duration}</span>}
                          </div>
                          {skills.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {skills.slice(0, 4).map((s) => (
                                <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "#8ab0d8" }}>{s}</span>
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
                          <p className="text-[10px]" style={{ color: "#5a7898" }}>open spots</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {org.opportunities.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-[#e8e8ec] mb-3">Opportunities</h2>
              <div className="space-y-2">
                {org.opportunities.map((opp) => (
                  <div key={opp.id} className="bg-[#16161a] border border-[#2a2a33] rounded-lg p-3">
                    <p className="font-medium text-sm text-[#e8e8ec]">{opp.title}</p>
                    {opp.description && (
                      <p className="text-xs text-[#9898a8] mt-1 line-clamp-2">{opp.description}</p>
                    )}
                    {opp.deadline && (
                      <p className="text-xs text-[#5a5a6a] mt-1">Due {format(new Date(opp.deadline), "MMM d, yyyy")}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right sidebar ─────────────────────────────────────── */}
        <div className="w-64 flex-shrink-0 space-y-4">
          <div className="bg-[#16161a] border border-[#2a2a33] rounded-xl p-4 sticky top-6">
            {org.deadline && (
              <div className="text-center mb-4">
                <p className="text-2xl font-bold text-[#e8e8ec]">{Math.max(0, daysLeft ?? 0)}</p>
                <p className="text-xs text-[#5a5a6a]">days remaining</p>
                <p className="text-xs text-[#9898a8] mt-1">
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
                className="flex items-center justify-center gap-1 w-full py-2.5 rounded-lg bg-[#4a80f0] hover:bg-[#6a9fff] text-[#0f0f11] text-sm font-semibold transition-colors"
              >
                Open workspace <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            ) : projects.length > 0 ? (
              <a
                href="#projects"
                className="w-full py-2.5 rounded-lg text-sm font-semibold bg-[#4a80f0] hover:bg-[#6a9fff] text-[#0f0f11] transition-colors text-center block"
              >
                View open projects ↓
              </a>
            ) : (
              <p className="text-xs text-center py-2" style={{ color: "var(--muted)" }}>
                No open projects yet.
              </p>
            )}

            <button
              onClick={() => setSaved((s) => !s)}
              className={cn(
                "flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border text-xs font-medium mt-2 transition-colors",
                saved
                  ? "border-[#4a80f0] text-[#4a80f0]"
                  : "border-[#2a2a33] text-[#9898a8] hover:border-[#4a80f0] hover:text-[#4a80f0]"
              )}
            >
              <Save className="w-3.5 h-3.5" fill={saved ? "currentColor" : "none"} />
              {saved ? "Saved" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminApplicationsPanel({
  applications, statuses, onDecision,
}: {
  applications: AdminApplication[];
  statuses: Record<string, string>;
  onDecision: (id: string, status: string) => void;
}) {
  const decide = async (id: string, status: "ACCEPTED" | "REJECTED") => {
    onDecision(id, status);
    await fetch(`/api/team-applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
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
      {pending.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text2)", fontFamily: "var(--font-mono, monospace)" }}>
            Pending · {pending.length}
          </p>
          <div className="space-y-3">
            {pending.map((app) => (
              <ApplicationCard key={app.id} app={app} status={statuses[app.id]} onDecide={decide} />
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
              <ApplicationCard key={app.id} app={app} status={statuses[app.id]} onDecide={decide} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ApplicationCard({
  app, status, onDecide,
}: {
  app: AdminApplication;
  status: string;
  onDecide: (id: string, s: "ACCEPTED" | "REJECTED") => void;
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "var(--surface)",
        border: `1px solid ${status === "ACCEPTED" ? "rgba(74,222,128,0.25)" : status === "REJECTED" ? "rgba(248,113,113,0.2)" : "var(--border-md)"}`,
        opacity: status !== "PENDING" ? 0.7 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Link href={`/teams/${app.team.id}`} className="font-semibold text-sm hover:underline" style={{ color: "var(--text)" }}>
              {app.team.name}
            </Link>
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(74,128,240,0.1)", color: "var(--blue)", fontFamily: "var(--font-mono, monospace)" }}>
              {app.orgProject.title}
            </span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              {formatDistanceToNow(new Date(app.submittedAt), { addSuffix: true })}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {app.team.members.map((m) => m.profile && (
              <div key={m.id} className="flex items-center gap-1.5">
                <Avatar src={m.profile.avatarUrl} name={m.profile.displayName} geniusType={m.profile.geniusType} size={22} />
                <span className="text-xs" style={{ color: "var(--text2)" }}>{m.profile.displayName}</span>
                {m.profile.geniusType && <GeniusTypeBadge type={m.profile.geniusType} size="sm" />}
              </div>
            ))}
          </div>
        </div>

        {status === "PENDING" ? (
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => onDecide(app.id, "ACCEPTED")}
              className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.25)" }}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Accept
            </button>
            <button
              onClick={() => onDecide(app.id, "REJECTED")}
              className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: "rgba(248,113,113,0.08)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}
            >
              <XCircle className="w-3.5 h-3.5" /> Reject
            </button>
          </div>
        ) : (
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
            style={{
              background: status === "ACCEPTED" ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.08)",
              color: status === "ACCEPTED" ? "#4ade80" : "#f87171",
            }}
          >
            {status === "ACCEPTED" ? "Accepted" : "Rejected"}
          </span>
        )}
      </div>
    </div>
  );
}

