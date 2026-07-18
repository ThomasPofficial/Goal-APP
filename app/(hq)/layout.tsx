import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { serverSignOut } from "@/lib/auth-actions";

export default async function HQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (dbUser?.role !== "ADMIN") redirect("/dashboard");

  return (
    <>
      <style>{`
        .hq-nav-link {
          display: block;
          padding: 8px 20px;
          color: var(--text);
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: 0.01em;
          transition: color 0.15s;
        }
        .hq-nav-link:hover {
          color: var(--amber);
        }
      `}</style>
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          background: "var(--bg)",
        }}
      >
        {/* Sidebar */}
        <aside
          style={{
            width: 220,
            minWidth: 220,
            background: "var(--surface)",
            borderRight: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            position: "fixed",
            top: 0,
            left: 0,
            bottom: 0,
            zIndex: 10,
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "24px 20px 16px 20px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--amber)",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              NIVARRO HQ
            </span>
          </div>

          {/* Nav */}
          <nav
            style={{
              padding: "12px 0",
              flex: 1,
            }}
          >
            <Link href="/hq" className="hq-nav-link">
              Schools
            </Link>
          </nav>

          {/* Footer — escape hatch back to the rest of the app + sign out */}
          <div style={{ borderTop: "1px solid var(--border)", padding: "12px 0" }}>
            <Link href="/orgs" className="hq-nav-link">
              ← Back to app
            </Link>
            <form action={serverSignOut}>
              <button
                type="submit"
                className="hq-nav-link"
                style={{
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Sign out
              </button>
            </form>
          </div>
        </aside>

        {/* Main content */}
        <main
          style={{
            marginLeft: 220,
            flex: 1,
            background: "var(--bg)",
            padding: "32px",
            minHeight: "100vh",
          }}
        >
          {children}
        </main>
      </div>
    </>
  );
}
