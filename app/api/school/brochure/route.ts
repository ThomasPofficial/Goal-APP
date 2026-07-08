import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { BrochureDocument } from "@/components/school/BrochureDocument";
import type { BrochureData, StudentRow, Testimonial } from "@/components/school/BrochureDocument";
import { getCollegeDomain, fetchLogoBase64 } from "@/lib/collegeLogos";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, name: true, profile: { select: { displayName: true } } },
  });
  if (dbUser?.role !== "SCHOOL" && dbUser?.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const schoolId = dbUser.role === "SCHOOL" ? session.user.id : searchParams.get("schoolId");
  if (!schoolId) return NextResponse.json({ error: "schoolId required" }, { status: 400 });

  const schoolUser = dbUser.role === "SCHOOL"
    ? dbUser
    : await prisma.user.findUnique({
        where: { id: schoolId },
        select: { name: true, profile: { select: { displayName: true } } },
      });
  const schoolName = schoolUser?.profile?.displayName ?? schoolUser?.name ?? "Your School";

  const [settings, profiles, reviews] = await Promise.all([
    prisma.schoolBrochureSettings.findUnique({ where: { schoolId } }),
    prisma.profile.findMany({
      where: { schoolId },
      select: {
        id: true,
        displayName: true,
        brochureData: {
          select: { college: true, jobTitle: true, employer: true, internshipTitle: true, internshipOrg: true },
        },
      },
      orderBy: { displayName: "asc" },
    }),
    prisma.brochureTestimonial.findMany({
      where: { schoolId, approved: true },
      select: { body: true, sourceName: true, sourceContext: true },
      orderBy: { displayOrder: "asc" },
    }),
  ]);

  const excluded = new Set<string>(settings ? JSON.parse(settings.excludedIds) : []);
  const cap = settings?.maxStudents ?? null;

  let included = profiles.filter((p) => !excluded.has(p.id));
  included.sort((a, b) => {
    const score = (d: typeof a.brochureData) => {
      if (!d) return 0;
      return (d.college ? 1 : 0) + (d.jobTitle && d.employer ? 2 : 0) + (d.internshipTitle && d.internshipOrg ? 1 : 0);
    };
    return score(b.brochureData) - score(a.brochureData);
  });
  if (cap) included = included.slice(0, cap);

  const students: StudentRow[] = included.map((p) => ({
    name:            p.displayName,
    college:         p.brochureData?.college ?? null,
    jobTitle:        p.brochureData?.jobTitle ?? null,
    employer:        p.brochureData?.employer ?? null,
    internshipTitle: p.brochureData?.internshipTitle ?? null,
    internshipOrg:   p.brochureData?.internshipOrg ?? null,
  }));

  const testimonials: Testimonial[] = reviews.map((r) => ({
    body:          r.body,
    sourceName:    r.sourceName,
    sourceContext: r.sourceContext ?? null,
  }));

  const collegesCount = new Set(students.map((s) => s.college).filter(Boolean)).size;
  const jobsCount = students.filter((s) => (s.jobTitle && s.employer) || (s.internshipTitle && s.internshipOrg)).length;

  const uniqueColleges = [...new Set(students.map((s) => s.college).filter(Boolean))] as string[];
  const logoMap: Record<string, string | null> = {};
  await Promise.all(
    uniqueColleges.map(async (college) => {
      const domain = getCollegeDomain(college);
      logoMap[college] = domain ? await fetchLogoBase64(domain) : null;
    })
  );

  const data: BrochureData = {
    schoolName,
    generatedAt: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    totalStudents: students.length,
    collegesCount,
    jobsCount,
    students,
    testimonials,
    logoMap,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(React.createElement(BrochureDocument, { data }) as any);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `attachment; filename="nivarro-brochure.pdf"`,
      "Cache-Control":       "no-store",
    },
  });
}
