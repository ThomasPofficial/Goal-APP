"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Gift } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import GeniusTypeBadge from "@/components/ui/GeniusTypeBadge";
import type { GeniusTypeKey } from "@/lib/geniusTypes";
import { cn } from "@/lib/utils";

interface RecruitmentItem {
  id: string;
  type: "recruitment";
  status: string;
  sortDate: string;
  message: string | null;
  createdAt: string;
  orgProject: { id: string; title: string; orgId: string; org: { id: string; name: string } };
  fromProfile: { id: string; displayName: string; avatarUrl: string | null; geniusType: string | null; handle: string | null };
  team: { id: string; name: string };
}

interface DecisionItem {
  id: string;
  type: "decision";
  status: string;
  sortDate: string;
  decidedAt: string | null;
  team: { id: string; name: string };
  orgProject: { id: string; title: string; orgId: string; org: { id: string; name: string } };
}

interface DonationItem {
  id: string;
  type: "donation";
  sortDate: string;
  amountCents: number;
  donorName: string | null;
}

type NotifItem = RecruitmentItem | DecisionItem | DonationItem;

export default function NotificationsClient({
  requests,
  applications,
  donations = [],
}: {
  requests: RecruitmentItem[];
  applications: DecisionItem[];
  donations?: DonationItem[];
}) {
  const [recruitStatuses, setRecruitStatuses] = useState<Record<string, string>>(() =>
    Object.fromEntries(requests.map((r) => [r.id, r.status]))
  );

  const respond = async (id: string, status: "ACCEPTED" | "DECLINED") => {
    setRecruitStatuses((prev) => ({ ...prev, [id]: status }));
    await fetch(`/api/recruitment-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  };

  const allItems: NotifItem[] = [
    ...requests.map((r) => ({ ...r, status: recruitStatuses[r.id] ?? r.status })),
    ...applications,
    ...donations,
  ].sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime());

  const pending = allItems.filter((i) => i.type === "recruitment" && i.status === "PENDING");
  const earlier = allItems.filter((i) => !(i.type === "recruitment" && i.status === "PENDING"));

  if (allItems.length === 0) {
    return (
      <div className="max-w-2xl space-y-6">
        <h1 className="text-2xl font-medium" style={{ fontFamily: "var(--font-serif)" }}>Notifications</h1>
        <div className="text-center py-16 space-y-2">
          <p className="text-sm" style={{ color: "var(--muted)" }}>No notifications yet.</p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>Acceptances, invitations, decisions, and donations show up here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-medium" style={{ fontFamily: "var(--font-serif)" }}>Notifications</h1>

      {pending.length > 0 && (
        <div>
          <p className="text-xs font-mono font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>
            PENDING · {pending.length}
          </p>
          <div className="space-y-3">
            {pending.map((item) =>
              item.type === "recruitment" ? (
                <RecruitCard key={item.id} req={item} status={recruitStatuses[item.id]} onRespond={respond} />
              ) : null
            )}
          </div>
        </div>
      )}

      {earlier.length > 0 && (
        <div>
          <p className="text-xs font-mono font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>
            EARLIER
          </p>
          <div className="space-y-3">
            {earlier.map((item) =>
              item.type === "recruitment" ? (
                <RecruitCard key={item.id} req={item} status={recruitStatuses[item.id]} onRespond={respond} />
              ) : item.type === "donation" ? (
                <DonationCard key={item.id} item={item} />
              ) : (
                <DecisionCard key={item.id} item={item} />
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DonationCard({ item }: { item: DonationItem }) {
  return (
    <div className="border p-4" style={{ borderColor: "rgba(34,197,94,0.35)", background: "rgba(34,197,94,0.06)" }}>
      <div className="flex items-start gap-3">
        <Gift size={16} style={{ color: "#22c55e", flexShrink: 0, marginTop: 2 }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
            {item.donorName?.trim() || "Someone"} donated ${(item.amountCents / 100).toFixed(2)} to you
          </p>
          <p className="text-xs mt-1 font-mono" style={{ color: "var(--muted)" }}>
            {formatDistanceToNow(new Date(item.sortDate), { addSuffix: true })}
          </p>
        </div>
      </div>
    </div>
  );
}

function DecisionCard({ item }: { item: DecisionItem }) {
  const accepted = item.status === "ACCEPTED";
  return (
    <div
      className={cn(
        "border p-4",
        accepted ? "border-emerald-800/40" : "border-red-900/30 opacity-70"
      )}
      style={{ background: "var(--surface)" }}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
          accepted ? "bg-emerald-400" : "bg-red-500"
        )} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
            {accepted ? "Your team was accepted" : "Application not accepted"}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text2)" }}>
            <Link href={`/teams/${item.team.id}`} className="hover:underline" style={{ color: "var(--blue)" }}>
              {item.team.name}
            </Link>
            {" · "}
            <Link
              href={`/orgs/${item.orgProject.orgId}/projects/${item.orgProject.id}`}
              className="hover:underline"
              style={{ color: "var(--text2)" }}
            >
              {item.orgProject.title}
            </Link>
            {" · "}
            {item.orgProject.org.name}
          </p>
          {item.decidedAt && (
            <p className="text-xs mt-1 font-mono" style={{ color: "var(--muted)" }}>
              {formatDistanceToNow(new Date(item.decidedAt), { addSuffix: true })}
            </p>
          )}
        </div>
        <span className={cn(
          "text-xs font-mono uppercase tracking-widest px-2 py-0.5 flex-shrink-0",
          accepted ? "text-emerald-400" : "text-red-400"
        )}>
          {accepted ? "ACCEPTED" : "REJECTED"}
        </span>
      </div>
    </div>
  );
}

function RecruitCard({
  req, status, onRespond,
}: {
  req: RecruitmentItem;
  status: string;
  onRespond: (id: string, s: "ACCEPTED" | "DECLINED") => void;
}) {
  return (
    <div className={cn(
      "border p-4 transition-opacity",
      status === "PENDING"
        ? "border-[rgba(74,128,240,0.28)]"
        : "border-[rgba(74,128,240,0.12)] opacity-60"
    )} style={{ background: "var(--surface)" }}>
      <div className="flex items-start gap-3">
        <Avatar
          src={req.fromProfile.avatarUrl}
          name={req.fromProfile.displayName}
          geniusType={req.fromProfile.geniusType as GeniusTypeKey | null}
          size="md"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/profile/${req.fromProfile.handle ?? req.fromProfile.id}`}
              className="font-medium text-sm hover:underline"
              style={{ color: "var(--text)" }}
            >
              {req.fromProfile.displayName}
            </Link>
            {req.fromProfile.geniusType && (
              <GeniusTypeBadge type={req.fromProfile.geniusType as GeniusTypeKey} size="sm" />
            )}
            <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>
              {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: "var(--text2)" }}>
            Invited you to join{" "}
            <Link href={`/teams/${req.team.id}`} className="hover:underline" style={{ color: "var(--blue)" }}>
              {req.team.name}
            </Link>
            {" for "}
            <Link
              href={`/orgs/${req.orgProject.orgId}/projects/${req.orgProject.id}`}
              className="hover:underline"
              style={{ color: "var(--blue)" }}
            >
              {req.orgProject.title}
            </Link>
            {" · "}
            {req.orgProject.org.name}
          </p>
          {req.message && (
            <p className="text-xs mt-1.5 italic px-3 py-2" style={{ background: "var(--surface2)", color: "var(--text2)" }}>
              &ldquo;{req.message}&rdquo;
            </p>
          )}
          {status === "PENDING" ? (
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => onRespond(req.id, "ACCEPTED")}
                className="btn-primary px-4 py-1.5 text-xs"
              >
                Accept
              </button>
              <button
                onClick={() => onRespond(req.id, "DECLINED")}
                className="btn-ghost px-4 py-1.5 text-xs"
              >
                Decline
              </button>
            </div>
          ) : (
            <span className="font-mono text-xs uppercase tracking-widest mt-2 inline-block" style={{
              color: status === "ACCEPTED" ? "var(--blue)" : "var(--muted)"
            }}>
              {status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
