"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Globe, HeartHandshake, Gift } from "lucide-react";

interface ActivityItem {
  id: string;
  kind: "community" | "mentorship" | "donation";
  label: string;
  lastMessage: string | null;
  updatedAt: string;
  unread: boolean;
  href: string;
}

export default function WalledNotificationsClient({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return <p style={{ color: "var(--n-text2)", fontSize: 14 }}>No activity yet.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 600 }}>
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          style={{
            display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px",
            border: item.kind === "donation" ? "1px solid rgba(34,197,94,0.35)" : "1px solid var(--border)",
            background: item.kind === "donation" ? "rgba(34,197,94,0.08)" : item.unread ? "rgba(232,137,58,0.08)" : "var(--surface)",
            textDecoration: "none",
          }}
        >
          {item.kind === "community" ? (
            <Globe size={16} style={{ color: "var(--amber)", flexShrink: 0, marginTop: 2 }} />
          ) : item.kind === "mentorship" ? (
            <HeartHandshake size={16} style={{ color: "var(--amber)", flexShrink: 0, marginTop: 2 }} />
          ) : (
            <Gift size={16} style={{ color: "#22c55e", flexShrink: 0, marginTop: 2 }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: item.unread ? 700 : 400, color: "var(--text)" }}>
              {item.label}
            </p>
            {item.lastMessage && (
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--n-text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.lastMessage}
              </p>
            )}
          </div>
          <span style={{ fontSize: 11, color: "var(--n-muted)", flexShrink: 0 }}>
            {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })}
          </span>
        </Link>
      ))}
    </div>
  );
}
