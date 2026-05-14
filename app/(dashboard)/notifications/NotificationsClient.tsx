"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import Avatar from "@/components/ui/Avatar";
import GeniusTypeBadge from "@/components/ui/GeniusTypeBadge";
import type { GeniusTypeKey } from "@/lib/geniusTypes";
import { cn } from "@/lib/utils";

interface RecruitmentRequest {
  id: string;
  status: string;
  message: string | null;
  createdAt: string;
  orgProject: {
    id: string;
    title: string;
    orgId: string;
    org: { id: string; name: string };
  };
  fromProfile: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    geniusType: string | null;
    handle: string | null;
  };
  team: { id: string; name: string };
}

export default function NotificationsClient({ requests }: { requests: RecruitmentRequest[] }) {
  const [statuses, setStatuses] = useState<Record<string, string>>(() =>
    Object.fromEntries(requests.map((r) => [r.id, r.status]))
  );

  const respond = async (id: string, status: "ACCEPTED" | "DECLINED") => {
    setStatuses((prev) => ({ ...prev, [id]: status }));
    await fetch(`/api/recruitment-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  };

  const pending = requests.filter((r) => statuses[r.id] === "PENDING");
  const handled = requests.filter((r) => statuses[r.id] !== "PENDING");

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-[#EAE8E0]">Notifications</h1>

      {requests.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <p className="text-sm text-[#5A5570]">No notifications yet.</p>
          <p className="text-xs text-[#5A5570]">When someone recruits you, you&apos;ll see it here.</p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#8A8898] uppercase tracking-wider mb-3">
                Pending · {pending.length}
              </p>
              <div className="space-y-3">
                {pending.map((req) => (
                  <RequestCard key={req.id} req={req} status={statuses[req.id]} onRespond={respond} />
                ))}
              </div>
            </div>
          )}
          {handled.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#8A8898] uppercase tracking-wider mb-3">Earlier</p>
              <div className="space-y-3">
                {handled.map((req) => (
                  <RequestCard key={req.id} req={req} status={statuses[req.id]} onRespond={respond} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RequestCard({
  req, status, onRespond,
}: {
  req: RecruitmentRequest;
  status: string;
  onRespond: (id: string, s: "ACCEPTED" | "DECLINED") => void;
}) {
  return (
    <div className={cn(
      "bg-[#0D1525] border rounded-xl p-4 transition-opacity",
      status === "PENDING"
        ? "border-[rgba(201,168,76,0.28)]"
        : "border-[rgba(201,168,76,0.12)] opacity-60"
    )}>
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
              className="font-medium text-sm text-[#EAE8E0] hover:text-[#c9a84c] transition-colors"
            >
              {req.fromProfile.displayName}
            </Link>
            {req.fromProfile.geniusType && (
              <GeniusTypeBadge type={req.fromProfile.geniusType as GeniusTypeKey} size="sm" />
            )}
            <span className="text-xs text-[#5A5570]">
              {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
            </span>
          </div>
          <p className="text-xs text-[#8A8898] mt-0.5">
            Invited you to join{" "}
            <span className="text-[#c9a84c]">{req.team.name}</span> for{" "}
            <Link
              href={`/orgs/${req.orgProject.orgId}/projects/${req.orgProject.id}`}
              className="text-[#c9a84c] hover:underline"
            >
              {req.orgProject.title}
            </Link>{" "}
            · {req.orgProject.org.name}
          </p>
          {req.message && (
            <p className="text-xs text-[#8A8898] mt-1.5 italic bg-[#111C32] rounded-lg px-3 py-2">
              &ldquo;{req.message}&rdquo;
            </p>
          )}
          {status === "PENDING" ? (
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => onRespond(req.id, "ACCEPTED")}
                className="px-4 py-1.5 rounded-lg bg-[#c9a84c] text-[#05080F] text-xs font-semibold hover:bg-[#e3c06a] transition-colors"
              >
                Accept
              </button>
              <button
                onClick={() => onRespond(req.id, "DECLINED")}
                className="px-4 py-1.5 rounded-lg border border-[rgba(201,168,76,0.12)] text-[#8A8898] text-xs hover:border-red-500/30 hover:text-red-400 transition-colors"
              >
                Decline
              </button>
            </div>
          ) : (
            <span className={cn(
              "inline-block mt-2 text-xs font-semibold px-2 py-0.5 rounded-full",
              status === "ACCEPTED" ? "bg-green-950 text-green-400" : "bg-[#1e1e24] text-[#5A5570]"
            )}>
              {status === "ACCEPTED" ? "Accepted" : "Declined"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
