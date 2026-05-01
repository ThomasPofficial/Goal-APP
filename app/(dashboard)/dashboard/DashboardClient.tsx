"use client";

import { useState } from "react";
import Link from "next/link";
import SkillCard from "@/components/profile/SkillCard";
import TraitBadge from "@/components/profile/TraitBadge";
import NotesPanel from "@/components/notes/NotesPanel";
import type { TraitCategory, GeniusType } from "@/data/traits";
import { GENIUS_TYPE_INFO } from "@/data/traits";
import {
  FolderOpen,
  FileText,
  MessageSquare,
  CheckCircle2,
  Circle,
  Plus,
  ArrowRight,
} from "lucide-react";
import { formatRelativeDate } from "@/lib/utils";

interface ProjectMember {
  memberId: string;
  userId: string;
  role: string;
  profile: {
    displayName: string;
    headline: string | null;
    avatarUrl: string | null;
    strengthSummary: string | null;
    geniusType: GeniusType | null;
    selfTraits: { name: string; category: TraitCategory }[];
    peerTraits: { name: string; category: TraitCategory; endorseCount: number }[];
  } | null;
}

interface Props {
  userName: string;
  geniusType: GeniusType | null;
  myTraits: { name: string; category: TraitCategory }[];
  strengthSummary: string | null;
  onboardingChecklist: {
    hasProfile: boolean;
    hasQuiz: boolean;
    hasProject: boolean;
    complete: boolean;
  };
  activeProject: {
    id: string;
    name: string;
    goal: string | null;
    status: string;
    memberCount: number;
  } | null;
  projectMembers: ProjectMember[];
  recentNotes: {
    id: string;
    title: string | null;
    content: string;
    pinned: boolean;
    updatedAt: string;
  }[];
  unreadConvoCount: number;
}

export default function DashboardClient({
  userName,
  geniusType,
  myTraits,
  strengthSummary,
  onboardingChecklist,
  activeProject,
  projectMembers,
  recentNotes,
  unreadConvoCount,
}: Props) {
  const [showNotes, setShowNotes] = useState(false);
  const genius = geniusType ? GENIUS_TYPE_INFO[geniusType] : null;

  const firstName = userName?.split(" ")[0] ?? "there";
  const otherMembers = projectMembers.filter(
    (m) => m.role !== "OWNER" || projectMembers.length === 1
  );

  return (
    <>
      {/* Notes panel (slide-in from right) */}
      {showNotes && <NotesPanel onClose={() => setShowNotes(false)} />}

      <div className="space-y-6">
        {/* Page heading */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#eaeaea]">
              Welcome back, {firstName}
            </h1>
            {genius && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-[#909098]">
                  {genius.icon}{" "}
                  <span style={{ color: genius.color }}>{genius.label}</span>
                </span>
              </div>
            )}
          </div>

          {/* Quick-access buttons (tucked away but visible) */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNotes(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-[#909098] hover:text-[#eaeaea] border border-[#1c1c20] hover:border-[#28282e] rounded-md px-3 py-2 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              Quick Notes
            </button>
            <Link
              href="/messages"
              className="relative flex items-center gap-1.5 text-xs font-medium text-[#909098] hover:text-[#eaeaea] border border-[#1c1c20] hover:border-[#28282e] rounded-md px-3 py-2 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Messages
              {unreadConvoCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#c9a84c] text-[#080809] text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadConvoCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Onboarding checklist — disappears when all 3 complete */}
        {!onboardingChecklist.complete && (
          <div className="bg-[#0d0d0e] border border-[#1c1c20] rounded-xl p-5">
            <h2 className="text-xs font-semibold text-[#909098] uppercase tracking-wider mb-3">
              Get Started
            </h2>
            <div className="space-y-2.5">
              <ChecklistItem
                done={onboardingChecklist.hasProfile}
                label="Complete your profile"
                description="Set your display name, headline, and select your 5 traits"
                href="/profile"
                action="Set up profile"
              />
              <ChecklistItem
                done={onboardingChecklist.hasQuiz}
                label="Discover your Genius Type"
                description="8 questions to find your archetype: Dynamo, Blaze, Tempo, or Steel"
                href="/quiz"
                action="Take the quiz"
              />
              <ChecklistItem
                done={onboardingChecklist.hasProject}
                label="Create your first project"
                description="Define a project goal and handpick collaborators from the community"
                href="/projects/new"
                action="Create project"
              />
            </div>
          </div>
        )}

        {/* Hero: Active project + member Skill Cards */}
        {activeProject ? (
          <div className="bg-[#0d0d0e] border border-[#1c1c20] rounded-xl overflow-hidden">
            {/* Project header */}
            <div className="px-5 py-4 border-b border-[#1c1c20] flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <FolderOpen className="w-4 h-4 text-[#c9a84c] flex-shrink-0" />
                  <Link
                    href={`/projects/${activeProject.id}`}
                    className="font-semibold text-[#eaeaea] hover:text-[#c9a84c] transition-colors truncate"
                  >
                    {activeProject.name}
                  </Link>
                  <span className="text-xs text-[#c9a84c] bg-[#c9a84c15] px-1.5 py-0.5 rounded flex-shrink-0">
                    Active
                  </span>
                </div>
                {activeProject.goal && (
                  <p className="text-sm text-[#909098] ml-6">
                    <span className="text-[#58586a]">Goal: </span>
                    {activeProject.goal}
                  </p>
                )}
              </div>
              <Link
                href={`/projects/${activeProject.id}`}
                className="text-xs text-[#909098] hover:text-[#c9a84c] flex-shrink-0 flex items-center gap-1 transition-colors"
              >
                Open <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Member Skill Cards */}
            {projectMembers.length > 0 ? (
              <div className="px-5 py-4">
                <div className="text-xs text-[#58586a] uppercase tracking-wider mb-3 font-medium">
                  Team · {projectMembers.length} member{projectMembers.length !== 1 ? "s" : ""}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {projectMembers.map((m) => {
                    if (!m.profile) return null;
                    return (
                      <SkillCard
                        key={m.memberId}
                        compact
                        data={{
                          userId: m.userId,
                          displayName: m.profile.displayName,
                          headline: m.profile.headline,
                          avatarUrl: m.profile.avatarUrl,
                          strengthSummary: m.profile.strengthSummary,
                          geniusType: m.profile.geniusType,
                          selfTraits: m.profile.selfTraits,
                          peerTraits: m.profile.peerTraits,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="px-5 py-4 text-center">
                <p className="text-sm text-[#58586a] mb-3">
                  No team members yet.
                </p>
                <Link
                  href={`/projects/${activeProject.id}`}
                  className="text-xs text-[#c9a84c] hover:text-[#e3c06a]"
                >
                  Add team members →
                </Link>
              </div>
            )}
          </div>
        ) : (
          // No active project CTA
          <div className="bg-[#0d0d0e] border border-dashed border-[#1c1c20] rounded-xl p-8 text-center">
            <FolderOpen className="w-8 h-8 text-[#58586a] mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-[#eaeaea] mb-1">
              No active project
            </h3>
            <p className="text-xs text-[#909098] mb-4 max-w-xs mx-auto">
              Create a project and handpick collaborators. Their Skill Cards will
              appear here on your dashboard.
            </p>
            <Link
              href="/projects/new"
              className="inline-flex items-center gap-1.5 text-sm font-medium bg-[#c9a84c] hover:bg-[#e3c06a] text-[#080809] rounded-md px-4 py-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Project
            </Link>
          </div>
        )}

        {/* My Traits */}
        <div className="bg-[#0d0d0e] border border-[#1c1c20] rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-[#909098] uppercase tracking-wider">
              My Traits
            </h2>
            <Link
              href="/profile"
              className="text-xs text-[#909098] hover:text-[#c9a84c] transition-colors"
            >
              Edit
            </Link>
          </div>

          {myTraits.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-2">
                {myTraits.map((t) => (
                  <TraitBadge
                    key={t.name}
                    name={t.name}
                    category={t.category}
                    size="md"
                  />
                ))}
              </div>
              {strengthSummary && (
                <p className="text-xs text-[#909098] mt-3 leading-relaxed border-t border-[#1c1c20] pt-3">
                  {strengthSummary}
                </p>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-xs text-[#58586a] mb-2">
                Select your 5 traits to complete your Skill Card.
              </p>
              <Link
                href="/profile"
                className="text-xs text-[#c9a84c] hover:text-[#e3c06a]"
              >
                Select traits →
              </Link>
            </div>
          )}
        </div>

        {/* Recent Notes (collapsed / summary view) */}
        {recentNotes.length > 0 && (
          <div className="bg-[#0d0d0e] border border-[#1c1c20] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-[#909098] uppercase tracking-wider">
                Recent Notes
              </h2>
              <button
                onClick={() => setShowNotes(true)}
                className="text-xs text-[#909098] hover:text-[#c9a84c] transition-colors"
              >
                View all
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {recentNotes.slice(0, 4).map((note) => (
                <button
                  key={note.id}
                  onClick={() => setShowNotes(true)}
                  className="text-left bg-[#131315] border border-[#1c1c20] rounded-lg p-3 hover:border-[#28282e] transition-colors"
                >
                  {note.title && (
                    <div className="text-xs font-medium text-[#eaeaea] truncate mb-1">
                      {note.pinned && <span className="text-[#c9a84c] mr-1">·</span>}
                      {note.title}
                    </div>
                  )}
                  <p className="text-xs text-[#909098] font-mono line-clamp-2 leading-relaxed">
                    {note.content}
                  </p>
                  <div className="text-[10px] text-[#58586a] mt-1.5">
                    {formatRelativeDate(note.updatedAt)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function ChecklistItem({
  done,
  label,
  description,
  href,
  action,
}: {
  done: boolean;
  label: string;
  description: string;
  href: string;
  action: string;
}) {
  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
        done ? "opacity-50" : "bg-[#131315]"
      }`}
    >
      {done ? (
        <CheckCircle2 className="w-4 h-4 text-[#4ADE80] flex-shrink-0 mt-0.5" />
      ) : (
        <Circle className="w-4 h-4 text-[#58586a] flex-shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[#eaeaea]">{label}</div>
        <div className="text-xs text-[#909098] mt-0.5">{description}</div>
      </div>
      {!done && (
        <Link
          href={href}
          className="flex-shrink-0 text-xs font-medium text-[#c9a84c] hover:text-[#e3c06a] border border-[#c9a84c30] hover:border-[#c9a84c60] rounded-md px-2.5 py-1.5 transition-colors whitespace-nowrap"
        >
          {action}
        </Link>
      )}
    </div>
  );
}
