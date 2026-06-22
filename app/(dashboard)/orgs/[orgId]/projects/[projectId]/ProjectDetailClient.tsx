"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, Clock, ExternalLink } from "lucide-react";
import ApplyModal from "@/components/ui/ApplyModal";
import GeniusTypeBadge from "@/components/ui/GeniusTypeBadge";
import type { GeniusTypeKey } from "@/lib/geniusTypes";
import { cn } from "@/lib/utils";

interface ProjectDetailClientProps {
  project: {
    id: string;
    orgId: string;
    title: string;
    description: string | null;
    shortDescription: string | null;
    fullDescription: string | null;
    openSpots: number;
    requiredSkills: string;
    preferredGeniusTypes: string;
    hoursPerWeek: string | null;
    duration: string | null;
    deadline: string | null;
    listingStatus: string;
    createdAt: string;
    org: { id: string; name: string; accentColor: string | null; maxTeamSize: number };
  };
  myProfileId: string | null;
  existingApplication: { id: string; status: string; teamId: string } | null;
}

export default function ProjectDetailClient({
  project,
  myProfileId,
  existingApplication,
}: ProjectDetailClientProps) {
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applied, setApplied] = useState<{ id: string; status: string; teamId: string } | null>(
    existingApplication
  );

  const requiredSkills: string[] = JSON.parse(project.requiredSkills || "[]");
  const preferredTypes: string[] = JSON.parse(project.preferredGeniusTypes || "[]");
  const accentColor = project.org.accentColor ?? "#1060d8";

  return (
    <div className="max-w-3xl space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm" style={{ color: "#5a7898" }}>
        <Link
          href={`/orgs/${project.orgId}`}
          className="flex items-center gap-1 hover:text-[#4a80f0] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> {project.org.name}
        </Link>
        <span>/</span>
        <span style={{ color: "#d8eeff" }}>{project.title}</span>
      </div>

      {/* Project details */}
      <div
        className="rounded-xl p-6"
        style={{ background: "var(--surface)", border: "1px solid var(--border-md)" }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h1
              className="text-2xl font-semibold mb-2"
              style={{ color: "var(--text)", fontFamily: "var(--font-serif)" }}
            >
              {project.title}
            </h1>
            {(project.fullDescription ?? project.shortDescription ?? project.description) && (
              <p className="text-sm leading-relaxed" style={{ color: "#8ab0d8" }}>
                {project.fullDescription ?? project.shortDescription ?? project.description}
              </p>
            )}
            <div className="flex flex-wrap gap-3 mt-3 text-xs" style={{ color: "#5a7898" }}>
              {project.hoursPerWeek && <span>⏱ {project.hoursPerWeek}</span>}
              {project.duration && <span>📅 {project.duration}</span>}
            </div>
            {requiredSkills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {requiredSkills.map((s) => (
                  <span
                    key={s}
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ border: "1px solid rgba(16,96,216,0.28)", color: "#4a80f0" }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
            {preferredTypes.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-[11px]" style={{ color: "#5a7898" }}>Preferred:</span>
                {preferredTypes.map((t) => (
                  <GeniusTypeBadge key={t} type={t as GeniusTypeKey} size="sm" />
                ))}
              </div>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-3xl font-bold" style={{ color: accentColor }}>
              {project.openSpots}
            </p>
            <p className="text-xs" style={{ color: "#5a7898" }}>open spots</p>
            {project.deadline && (
              <p className="text-xs mt-1" style={{ color: "#8ab0d8" }}>
                Deadline: {format(new Date(project.deadline), "MMM d, yyyy")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Apply / status section */}
      <div
        className="rounded-xl p-5"
        style={{ background: "var(--surface)", border: "1px solid var(--border-md)" }}
      >
        {applied ? (
          <div className="space-y-2">
            <div
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold",
                applied.status === "ACCEPTED"
                  ? "bg-green-950 text-green-400"
                  : applied.status === "REJECTED"
                  ? "bg-red-950/40 text-red-400"
                  : "bg-blue-950 text-blue-400"
              )}
            >
              <Clock className="w-3.5 h-3.5" />
              {applied.status === "ACCEPTED"
                ? "Accepted!"
                : applied.status === "REJECTED"
                ? "Not selected"
                : "Under review"}
            </div>
            <p className="text-xs" style={{ color: "#8ab0d8" }}>
              {applied.status === "ACCEPTED"
                ? "Congratulations — your application has been accepted."
                : applied.status === "REJECTED"
                ? "You weren't selected for this project."
                : "The org is reviewing your application."}
            </p>
            <Link
              href={`/teams/${applied.teamId}`}
              className="inline-flex items-center gap-1 text-xs hover:underline mt-1"
              style={{ color: "#4a80f0" }}
            >
              View team workspace <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        ) : project.listingStatus !== "OPEN" ? (
          <p className="text-sm" style={{ color: "#8ab0d8" }}>Applications are closed.</p>
        ) : !myProfileId ? (
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm" style={{ color: "#8ab0d8" }}>
              You own this project. Review applications from your org dashboard.
            </p>
            <Link
              href={`/orgs/${project.orgId}`}
              className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{
                background: "rgba(74,128,240,0.12)",
                color: "var(--blue)",
                border: "1px solid rgba(74,128,240,0.3)",
              }}
            >
              Go to org dashboard <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                Ready to apply?
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                Apply solo or bring teammates — you choose during the application.
              </p>
            </div>
            <button
              onClick={() => setShowApplyModal(true)}
              className="btn-primary px-5 py-2 text-sm font-semibold whitespace-nowrap"
            >
              Apply now →
            </button>
          </div>
        )}
      </div>

      {showApplyModal && (
        <ApplyModal
          orgProjectId={project.id}
          projectTitle={project.title}
          orgName={project.org.name}
          maxTeamSize={project.org.maxTeamSize}
          onSuccess={(result) => {
            setApplied({ id: "new", status: result.status, teamId: result.teamId });
            setShowApplyModal(false);
          }}
          onClose={() => setShowApplyModal(false)}
        />
      )}
    </div>
  );
}
