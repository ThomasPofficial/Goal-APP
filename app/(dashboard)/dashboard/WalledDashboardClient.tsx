import Link from "next/link";
import { School, Globe, HeartHandshake, Bell } from "lucide-react";

interface Props {
  displayName: string;
  schoolName: string;
  hasUnreadCommunity: boolean;
  hasUnreadMentorship: boolean;
}

const CARDS = [
  { href: "/my-school", label: "My School", Icon: School, description: "Staff, alumni, and mentors at your school" },
  { href: "/communities", label: "Community Chat", Icon: Globe, unreadKey: "hasUnreadCommunity" as const, description: "Your school's shared channel" },
  { href: "/partnerships", label: "Partnerships", Icon: HeartHandshake, unreadKey: "hasUnreadMentorship" as const, description: "Your partnership requests and chats" },
  { href: "/notifications", label: "Notifications", Icon: Bell, description: "Recent activity" },
];

export default function WalledDashboardClient({ displayName, schoolName, hasUnreadCommunity, hasUnreadMentorship }: Props) {
  const unread: Record<string, boolean> = { hasUnreadCommunity, hasUnreadMentorship };

  return (
    <div style={{ maxWidth: 800 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 3vw, 36px)", letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 8px" }}>
        Welcome, {displayName}
      </h1>
      <p style={{ fontSize: 14, color: "var(--n-text2)", margin: "0 0 32px" }}>
        Your hub at {schoolName}.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
        {CARDS.map(({ href, label, Icon, description, unreadKey }) => (
          <Link
            key={href}
            href={href}
            style={{
              display: "block",
              padding: "20px 20px",
              border: "1px solid var(--border)",
              background: "var(--surface)",
              textDecoration: "none",
              position: "relative",
            }}
          >
            {unreadKey && unread[unreadKey] && (
              <span
                style={{
                  position: "absolute", top: 16, right: 16,
                  width: 8, height: 8, borderRadius: "50%",
                  background: "var(--amber)",
                }}
              />
            )}
            <Icon size={20} style={{ color: "var(--amber)", marginBottom: 10 }} />
            <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{label}</p>
            <p style={{ margin: 0, fontSize: 12, color: "var(--n-text2)" }}>{description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
