import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import colleges from "@/lib/colleges.json";
import { DestinationsMap, BrochureButton, BrochureCurationPanel } from "./DynamicComponents";

type CollegeData = { lat: number; lng: number; state: string };
const collegeData = colleges as Record<string, CollegeData>;

export default async function DestinationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const schoolId = session.user.id;

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "SCHOOL" && dbUser?.role !== "ADMIN") redirect("/dashboard");

  const profiles = await prisma.profile.findMany({
    where: {
      OR: [
        { intendedCollege: { not: null } },
        { confirmedCollege: { not: null } },
      ],
    },
    select: {
      displayName: true,
      intendedCollege: true,
      intendedMajor: true,
      confirmedCollege: true,
      graduationYear: true,
    },
  });

  const destinationMap: Record<string, { students: string[]; major?: string }> = {};
  for (const p of profiles) {
    const destination = p.confirmedCollege ?? p.intendedCollege;
    if (!destination) continue;
    if (!destinationMap[destination]) destinationMap[destination] = { students: [] };
    destinationMap[destination].students.push(p.displayName ?? "Anonymous");
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
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 3vw, 36px)", letterSpacing: "-0.02em", color: "var(--text)", margin: 0 }}>
            College Destinations
          </h1>
          <p style={{ fontSize: 14, color: "var(--n-text2)", marginTop: 4, marginBottom: 0 }}>
            Where Nivarro students are heading — hover a pin to see who&apos;s going where.
          </p>
        </div>
        <Suspense fallback={null}>
          <BrochureButton />
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
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 0,
              padding: "14px 18px",
            }}
          >
            <p style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 36, color: "var(--amber)", letterSpacing: "-0.04em", lineHeight: 1 }}>{value}</p>
            <p style={{ margin: "4px 0 0", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--n-muted)" }}>{label}</p>
          </div>
        ))}
      </div>

      <Suspense fallback={
        <div style={{ height: 480, background: "var(--surface)", borderRadius: 0, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)" }}>
          <span style={{ color: "var(--n-text2)", fontSize: 14 }}>Loading map…</span>
        </div>
      }>
        <DestinationsMap destinations={destinations} />
      </Suspense>

      {destinations.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: "0 0 12px" }}>
            All Destinations
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8 }}>
            {destinations
              .sort((a, b) => b.students.length - a.students.length)
              .map((d) => (
                <div
                  key={d.college}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 0,
                    padding: "10px 14px",
                  }}
                >
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{d.college}</p>
                  <p style={{ margin: "3px 0 0", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--amber)", letterSpacing: "0.05em" }}>
                    {d.students.length} student{d.students.length !== 1 ? "s" : ""}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--n-text2)" }}>
                    {d.students.join(", ")}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

      {destinations.length === 0 && (
        <div style={{ marginTop: 20, padding: "32px 24px", background: "var(--surface)", borderRadius: 0, border: "1px solid var(--border)", textAlign: "center" }}>
          <p style={{ color: "var(--n-text2)", fontSize: 14, margin: 0 }}>
            No college destinations set yet. Students can update their intended college in their profile.
          </p>
        </div>
      )}

      <Suspense fallback={null}>
        <BrochureCurationPanel schoolId={schoolId} />
      </Suspense>
    </div>
  );
}
