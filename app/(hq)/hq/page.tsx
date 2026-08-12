import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function HQSchoolsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (dbUser?.role !== "ADMIN") redirect("/dashboard");

  // Fetch all school users with their profiles
  const schools = await prisma.user.findMany({
    where: { role: "SCHOOL" },
    select: {
      id: true,
      email: true,
      createdAt: true,
      profile: {
        select: {
          displayName: true,
          headline: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Get member counts for all schools in a single grouped query. Alumni are
  // linked via AlumniSchool (Profile.schoolId is null for them post multi-school
  // migration), so direct Profile counts and AlumniSchool counts must be summed
  // per school to avoid silently undercounting alumni.
  const schoolIds = schools.map((s) => s.id);
  const [memberCountRows, alumniCountRows] = schoolIds.length
    ? await Promise.all([
        prisma.profile.groupBy({
          by: ["schoolId"],
          where: { schoolId: { in: schoolIds } },
          _count: { id: true },
        }),
        prisma.alumniSchool.groupBy({
          by: ["schoolId"],
          where: { schoolId: { in: schoolIds } },
          _count: { id: true },
        }),
      ])
    : [[], []];

  const countMap: Record<string, number> = {};
  for (const row of memberCountRows) {
    if (row.schoolId) countMap[row.schoolId] = (countMap[row.schoolId] ?? 0) + row._count.id;
  }
  for (const row of alumniCountRows) {
    countMap[row.schoolId] = (countMap[row.schoolId] ?? 0) + row._count.id;
  }

  return (
    <div>
      {/* Page header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 32,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 36,
              fontWeight: 700,
              color: "var(--text)",
              margin: 0,
              lineHeight: 1.1,
              letterSpacing: "0.01em",
            }}
          >
            Schools
          </h1>
          <p
            style={{
              color: "var(--muted)",
              fontSize: 14,
              marginTop: 6,
            }}
          >
            Manage school clients and their members.
          </p>
        </div>

        <Link
          href="/hq/schools/new"
          style={{
            display: "inline-block",
            padding: "9px 18px",
            background: "var(--amber)",
            color: "#000",
            fontWeight: 600,
            fontSize: 13,
            textDecoration: "none",
            borderRadius: 0,
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
          }}
        >
          + Add New School
        </Link>
      </div>

      {/* Empty state */}
      {schools.length === 0 && (
        <div
          style={{
            border: "1px solid var(--border)",
            background: "var(--surface)",
            padding: "48px 32px",
            textAlign: "center",
            borderRadius: 0,
          }}
        >
          <p
            style={{
              color: "var(--muted)",
              fontSize: 15,
              margin: 0,
            }}
          >
            No schools yet.{" "}
            <Link
              href="/hq/schools/new"
              style={{ color: "var(--amber)", textDecoration: "underline" }}
            >
              Add the first school
            </Link>{" "}
            to get started.
          </p>
        </div>
      )}

      {/* School cards grid */}
      {schools.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {schools.map((school) => {
            const memberCount = countMap[school.id] ?? 0;
            const displayName = school.profile?.displayName ?? school.email ?? school.id;
            const headline = school.profile?.headline ?? null;
            const dateAdded = school.createdAt.toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            });

            return (
              <div
                key={school.id}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 0,
                  padding: "20px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {/* School name */}
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 16,
                    color: "var(--text)",
                    lineHeight: 1.3,
                  }}
                >
                  {displayName}
                </div>

                {/* Tagline */}
                {headline && (
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--muted)",
                      lineHeight: 1.4,
                    }}
                  >
                    {headline}
                  </div>
                )}

                {/* Member count badge + date */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginTop: 4,
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 10px",
                      background: "var(--surface2, rgba(255,255,255,0.06))",
                      border: "1px solid var(--border)",
                      color: "var(--amber)",
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: "var(--font-mono)",
                      borderRadius: 0,
                    }}
                  >
                    {memberCount} member{memberCount !== 1 ? "s" : ""}
                  </span>

                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--muted)",
                    }}
                  >
                    Added {dateAdded}
                  </span>
                </div>

                {/* Manage link */}
                <div style={{ marginTop: 8, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                  <Link
                    href={`/hq/schools/${school.id}`}
                    style={{
                      fontSize: 13,
                      color: "var(--amber)",
                      textDecoration: "none",
                      fontWeight: 600,
                      letterSpacing: "0.02em",
                    }}
                  >
                    Manage &rarr;
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
