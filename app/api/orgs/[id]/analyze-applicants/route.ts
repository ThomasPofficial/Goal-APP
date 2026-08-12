import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: orgId } = await params;
  const { projectId } = await req.json().catch(() => ({}));

  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: { createdById: true, name: true },
  });
  if (!org || org.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const projectWhere = projectId ? { id: projectId, orgId } : { orgId };
  const project = await prisma.orgProject.findFirst({
    where: projectWhere,
    select: {
      id: true,
      title: true,
      requiredSkills: true,
      teamApplications: {
        where: { status: { in: ["PENDING", "ACCEPTED"] } },
        select: {
          id: true,
          status: true,
          whyJoin: true,
          submittedAt: true,
          team: {
            select: {
              name: true,
              members: {
                select: {
                  profile: {
                    select: {
                      id: true,
                      displayName: true,
                      handle: true,
                      headline: true,
                      bio: true,
                      strengthSummary: true,
                      grade: true,
                      schoolName: true,
                      interests: true,
                      orgReviews: {
                        select: {
                          body: true,
                          org: { select: { name: true } },
                          orgProject: { select: { title: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const requiredSkills: string[] = JSON.parse(project.requiredSkills || "[]");

  const applicantBlocks = project.teamApplications.map((app) => {
    const members = app.team.members
      .filter((m) => m.profile)
      .map((m) => {
        const p = m.profile!;
        const interests: string[] = JSON.parse(p.interests || "[]");
        const reviews = p.orgReviews.map((r) => `  [${r.org.name} — ${r.orgProject.title}]: "${r.body}"`).join("\n");
        return `
    Name: ${p.displayName}
    Handle: @${p.handle ?? "none"}
    Grade: ${p.grade ?? "unknown"} | School: ${p.schoolName ?? "unknown"}
    Headline: ${p.headline ?? "none"}
    Bio: ${p.bio ?? "none"}
    Strength Summary: ${p.strengthSummary ?? "none"}
    Interests: ${interests.join(", ") || "none"}
    Past Org Reviews (${p.orgReviews.length}):
${reviews || "    No reviews yet"}`;
      })
      .join("\n---\n");

    return `
APPLICATION ID: ${app.id} | Team: ${app.team.name} | Status: ${app.status}
Why they want to join: ${app.whyJoin ?? "not provided"}
Team members:
${members}`;
  });

  const prompt = `You are an expert talent evaluator for ${org.name}.

PROJECT: "${project.title}"
Required Skills: ${requiredSkills.join(", ") || "not specified"}

You are reviewing ${project.teamApplications.length} application(s). For each application, analyze the team members' profiles, past org reviews (which function as recommendation letters and reference checks), bios, and stated reasons for applying.

APPLICATIONS:
${applicantBlocks.join("\n\n====\n\n")}

For each application, provide:
1. A match score (0-100) based on fit with the project requirements
2. Key strengths relevant to this specific project
3. Any concerns or gaps
4. A hire/skip/maybe recommendation with one-sentence reasoning

Then provide an OVERALL RANKING of all applications with your top recommendation highlighted.

Be specific, direct, and concrete. Reference actual things from their profiles and reviews.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: "You are a concise, direct talent evaluator. Be specific. No filler. Reference actual profile data.",
    messages: [{ role: "user", content: prompt }],
  });

  const analysis = message.content[0].type === "text" ? message.content[0].text : "";

  return NextResponse.json({
    projectTitle: project.title,
    applicationCount: project.teamApplications.length,
    analysis,
    model: "claude-sonnet-4-6",
  });
}
