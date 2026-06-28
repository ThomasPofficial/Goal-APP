import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import colleges from "@/lib/colleges.json";

const DestinationsMap = dynamic(() => import("@/components/school/DestinationsMap"), { ssr: false });
const BrochureButton = dynamic(() => import("@/components/school/BrochureButton"), { ssr: false });

type CollegeData = { lat: number; lng: number; state: string };
const collegeData = colleges as Record<string, CollegeData>;

export default async function DestinationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const profiles = await prisma.profile.findMany({
    where: { intendedCollege: { not: null } },
    select: {
      displayName: true,
      intendedCollege: true,
      intendedMajor: true,
      graduationYear: true,
    },
  });

  const destinationMap: Record<string, { students: string[]; major?: string }> = {};
  for (const p of profiles) {
    if (!p.intendedCollege) continue;
    if (!destinationMap[p.intendedCollege]) destinationMap[p.intendedCollege] = { students: [] };
    destinationMap[p.intendedCollege].students.push(
      p.displayName ?? "Anonymous"
    );
  }

  const destinations = Object.entries(destinationMap)
    .filter(([college]) => college in collegeData)
    .map(([college, { students }]) => ({
      college,
      lat: collegeData[college].lat,
      lng: collegeData[college].lng,
      students,
    }));

  const totalStudents = profiles.length;
  const states = [...new Set(
    Object.entries(destinationMap)
      .filter(([college]) => college in collegeData)
      .map(([college]) => collegeData[college].state)
  )].length;

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", margin: 0, letterSpacing: "-0.03em" }}>
            College Destinations
          </h1>
          <p style={{ fontSize: 14, color: "var(--text2)", marginTop: 4, marginBottom: 0 }}>
            Where Nivarro students are heading — hover a pin to see who&apos;s going where.
          </p>
        </div>
        <Suspense fallback={null}>
          <BrochureButton destinations={destinations} totalStudents={totalStudents} states={states} />
        </Suspense>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "Students tracked", value: totalStudents },
          { label: "Schools", value: destinations.length },
          { label: "States", value: states },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              flex: "1 1 120px",
              background: "var(--n-bg2)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "14px 18px",
            }}
          >
            <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "var(--blue)", letterSpacing: "-0.04em" }}>{value}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text2)", fontWeight: 500 }}>{label}</p>
          </div>
        ))}
      </div>

      <Suspense fallback={
        <div style={{ height: 480, background: "var(--n-bg2)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "var(--text2)", fontSize: 14 }}>Loading map…</span>
        </div>
      }>
        <DestinationsMap destinations={destinations} />
      </Suspense>

      {destinations.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 12, letterSpacing: "-0.01em" }}>
            All Destinations
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8 }}>
            {destinations
              .sort((a, b) => b.students.length - a.students.length)
              .map((d) => (
                <div
                  key={d.college}
                  style={{
                    background: "var(--n-bg2)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "10px 14px",
                  }}
                >
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{d.college}</p>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--blue)" }}>
                    {d.students.length} student{d.students.length !== 1 ? "s" : ""}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text2)" }}>
                    {d.students.join(", ")}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

      {destinations.length === 0 && (
        <div style={{ marginTop: 20, padding: "32px 24px", background: "var(--n-bg2)", borderRadius: 12, border: "1px solid var(--border)", textAlign: "center" }}>
          <p style={{ color: "var(--text2)", fontSize: 14, margin: 0 }}>
            No college destinations set yet. Students can update their intended college in their profile.
          </p>
        </div>
      )}
    </div>
  );
}
