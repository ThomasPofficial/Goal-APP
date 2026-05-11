"use client";

import { useState } from "react";
import Link from "next/link";
import { format, differenceInDays } from "date-fns";
import { ExternalLink, Save, Users, Calendar, MapPin } from "lucide-react";
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

const CATEGORY_COLORS: Record<string, string> = {
  ACCELERATOR: "#F59E0B", FELLOWSHIP: "#6366F1", INTERNSHIP: "#14B8A6",
  COMPETITION: "#F97316", BOOTCAMP: "#8B5CF6", RESEARCH: "#06B6D4", CLUB: "#10B981",
};

export default function OrgDetailClient({
  org, myProfileId, myTeamId,
}: {
  org: OrgDetail; myProfileId: string | null; myTeamId: string | null;
}) {
  const [saved, setSaved] = useState(false);
  const [applyStep, setApplyStep] = useState<0 | 1 | 2 | 3>(0);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [whyJoin, setWhyJoin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const accentColor = org.accentColor ?? CATEGORY_COLORS[org.category] ?? "#c9a84c";
  const daysLeft = org.deadline ? differenceInDays(new Date(org.deadline), new Date()) : null;
  const isClosed = org.status === "CLOSED";

  const handleApply = async () => {
    if (!selectedTeamId || !whyJoin.trim()) return;
    setSubmitting(true);
    await fetch(`/api/orgs/${org.id}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId: selectedTeamId, whyJoin }),
    });
    setSubmitting(false);
    setSubmitted(true);
    setApplyStep(0);
  };

  return (
    <div>
      {/* Hero */}
      <div
        className="h-48 rounded-xl mb-6 flex items-end p-6"
        style={{ background: org.heroUrl ? `url(${org.heroUrl}) center/cover` : `linear-gradient(135deg, ${accentColor}40, ${accentColor}10)` }}
      >
        <div className="flex items-end gap-4">
          <div className="w-16 h-16 rounded-xl border-4 border-[#0f0f11] flex items-center justify-center text-2xl font-bold text-white" style={{ background: accentColor }}>
            {org.name[0]}
          </div>
          <div>
            <p className="font-bold text-xl text-white drop-shadow">{org.name}</p>
            {org.tagline && <p className="text-sm text-white/80">{org.tagline}</p>}
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* ── Left content ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-6">
          {org.description && (
            <div>
              <h2 className="text-sm font-semibold text-[#e8e8ec] mb-2">About</h2>
              <p className="text-sm text-[#9898a8] leading-relaxed">{org.description}</p>
            </div>
          )}

          {org.whatWeSeek && (
            <div className="border-l-4 pl-4 py-2" style={{ borderColor: accentColor }}>
              <h3 className="text-xs font-semibold text-[#9898a8] uppercase tracking-wider mb-1">What we're looking for</h3>
              <p className="text-sm text-[#9898a8] leading-relaxed">{org.whatWeSeek}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            {org.format && (
              <div className="flex items-center gap-2 text-[#9898a8]">
                <MapPin className="w-4 h-4 text-[#5a5a6a]" />
                {org.format}
              </div>
            )}
            {org.location && (
              <div className="flex items-center gap-2 text-[#9898a8]">
                <MapPin className="w-4 h-4 text-[#5a5a6a]" />
                {org.location}
              </div>
            )}
            {org.stipend && (
              <div className="text-[#9898a8]">
                <span className="font-medium">Stipend: </span>{org.stipend}
              </div>
            )}
            <div className="flex items-center gap-2 text-[#9898a8]">
              <Users className="w-4 h-4 text-[#5a5a6a]" />
              Team size: <span className="font-medium">{org.minTeamSize}–{org.maxTeamSize}</span>
            </div>
          </div>

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

            {submitted ? (
              <div className="text-center py-2">
                <p className="text-sm font-semibold text-green-600 dark:text-green-400">Application submitted!</p>
                {myTeamId && (
                  <Link href={`/teams/${myTeamId}`} className="text-xs text-[#c9a84c] mt-1 block">View application →</Link>
                )}
              </div>
            ) : myTeamId ? (
              <Link
                href={`/teams/${myTeamId}`}
                className="flex items-center justify-center gap-1 w-full py-2.5 rounded-lg bg-[#c9a84c] hover:bg-[#e3c06a] text-[#0f0f11] text-sm font-semibold transition-colors"
              >
                Open workspace <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            ) : applyStep === 0 ? (
              <button
                onClick={() => !isClosed && setApplyStep(1)}
                disabled={isClosed}
                className="w-full py-2.5 rounded-lg text-sm font-semibold bg-[#c9a84c] hover:bg-[#e3c06a] text-[#0f0f11] transition-colors disabled:opacity-40"
              >
                {isClosed ? "Applications closed" : "Apply with your team"}
              </button>
            ) : (
              <ApplicationFlow
                step={applyStep}
                setStep={setApplyStep}
                orgId={org.id}
                selectedTeamId={selectedTeamId}
                setSelectedTeamId={setSelectedTeamId}
                whyJoin={whyJoin}
                setWhyJoin={setWhyJoin}
                submitting={submitting}
                onSubmit={handleApply}
              />
            )}

            <button
              onClick={() => setSaved((s) => !s)}
              className={cn(
                "flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border text-xs font-medium mt-2 transition-colors",
                saved
                  ? "border-[#c9a84c] text-[#c9a84c]"
                  : "border-[#2a2a33] text-[#9898a8] hover:border-[#c9a84c] hover:text-[#c9a84c]"
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

function ApplicationFlow({
  step, setStep, orgId, selectedTeamId, setSelectedTeamId, whyJoin, setWhyJoin, submitting, onSubmit,
}: {
  step: 1 | 2 | 3; setStep: (s: 1 | 2 | 3) => void;
  orgId: string; selectedTeamId: string | null; setSelectedTeamId: (id: string) => void;
  whyJoin: string; setWhyJoin: (s: string) => void;
  submitting: boolean; onSubmit: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {[1, 2, 3].map((s) => (
          <div key={s} className={cn("flex-1 h-1 rounded-full", step >= s ? "bg-[#c9a84c]" : "bg-[#2a2a33]")} />
        ))}
      </div>

      {step === 1 && (
        <div>
          <p className="text-xs font-semibold text-[#9898a8] mb-2">Select your team</p>
          <input
            value={selectedTeamId ?? ""}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            placeholder="Team ID (or select from /teams)"
            className="w-full text-xs px-2 py-1.5 rounded border border-[#2a2a33] bg-transparent text-[#e8e8ec] focus:outline-none focus:border-[#c9a84c]"
          />
          <button
            onClick={() => selectedTeamId && setStep(2)}
            disabled={!selectedTeamId}
            className="mt-2 w-full py-2 rounded-lg text-xs font-semibold bg-[#c9a84c] hover:bg-[#e3c06a] text-[#0f0f11] disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
      {step === 2 && (
        <div>
          <p className="text-xs font-semibold text-[#9898a8] mb-2">Why do you want to join?</p>
          <textarea
            value={whyJoin}
            onChange={(e) => setWhyJoin(e.target.value)}
            rows={4}
            className="w-full text-xs px-2 py-1.5 rounded border border-[#2a2a33] bg-transparent text-[#e8e8ec] resize-none focus:outline-none focus:border-[#c9a84c]"
          />
          <div className="flex gap-2 mt-2">
            <button onClick={() => setStep(1)} className="flex-1 py-2 rounded-lg text-xs border border-[#2a2a33] text-[#9898a8]">← Back</button>
            <button onClick={() => whyJoin.trim() && setStep(3)} disabled={!whyJoin.trim()} className="flex-1 py-2 rounded-lg text-xs font-semibold bg-[#c9a84c] hover:bg-[#e3c06a] text-[#0f0f11] disabled:opacity-40">Review →</button>
          </div>
        </div>
      )}
      {step === 3 && (
        <div>
          <p className="text-xs font-semibold text-[#9898a8] mb-1">Review & submit</p>
          <p className="text-xs text-[#9898a8] line-clamp-3 bg-[#1e1e24] rounded p-2 mb-2">{whyJoin}</p>
          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className="flex-1 py-2 rounded-lg text-xs border border-[#2a2a33] text-[#9898a8]">← Back</button>
            <button onClick={onSubmit} disabled={submitting} className="flex-1 py-2 rounded-lg text-xs font-semibold bg-[#c9a84c] hover:bg-[#e3c06a] text-[#0f0f11] disabled:opacity-40">
              {submitting ? "Submitting…" : "Submit"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
