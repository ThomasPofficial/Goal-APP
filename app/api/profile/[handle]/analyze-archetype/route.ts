import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ANIMAL_ARCHETYPES, ANIMAL_KEYS, type AnimalKey } from "@/lib/animalArchetypes";

const anthropic = new Anthropic();

export async function POST(_req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { handle } = await params;

  const profile = await prisma.profile.findUnique({
    where: { handle },
    include: {
      user: { select: { id: true } },
      orgReviews: { select: { body: true, createdAt: true, org: { select: { name: true } } } },
    },
  });

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const isOwn = profile.user.id === session.user.id;
  const isAdmin = session.user.email === "team.nivarro@gmail.com";
  if (!isOwn && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const qualifyingReviews = profile.orgReviews.filter((r) => {
    const wordCount = r.body.trim().split(/\s+/).length;
    return wordCount >= 240;
  });

  if (qualifyingReviews.length === 0) {
    return NextResponse.json(
      { error: "At least one org review of 240+ words is required before your archetypes can be analyzed." },
      { status: 422 }
    );
  }

  // Message engagement (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const msgCount = await prisma.message.count({
    where: { senderId: profile.user.id, createdAt: { gte: thirtyDaysAgo } },
  });

  const animalList = ANIMAL_KEYS.map((k) => {
    const a = ANIMAL_ARCHETYPES[k];
    return `- ${a.name} (${a.tagline}): ${a.description} Superpower: ${a.superpower}`;
  }).join("\n");

  const reviewsText = qualifyingReviews
    .map((r) => `[Review from ${r.org.name}]:\n${r.body}`)
    .join("\n\n---\n\n");

  const prompt = `You are an expert at analyzing how people work and collaborating in high-stakes settings.
Your task is to assign 2-3 Animal Archetypes to a student based on their org reviews and engagement data.

STUDENT PROFILE:
- Genius Type: ${profile.geniusType ?? "Unknown"}
- Messages sent in last 30 days: ${msgCount}

ORG REVIEWS (written by organizations about this student):
${reviewsText}

AVAILABLE ANIMAL ARCHETYPES:
${animalList}

INSTRUCTIONS:
1. Analyze the reviews carefully for behavioral signals: how the student works, their role in teams, their pace, their depth.
2. Assign exactly 2 or 3 archetypes that best describe this student. Put the MOST fitting one first.
3. Write a brief analysis (2-3 sentences) explaining why these archetypes fit, referencing specific evidence from the reviews.
4. Be honest — don't just pick flattering archetypes.

RESPOND ONLY with valid JSON in this exact format:
{
  "archetypes": ["gorilla", "owl"],
  "analysis": "Your brief analysis here referencing specific review evidence."
}

Valid archetype keys: gorilla, tiger, cheetah, lion, hyena, owl, wolf, shark`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (message.content[0] as { text: string }).text.trim();

  let parsed: { archetypes: string[]; analysis: string };
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    return NextResponse.json({ error: "AI returned invalid JSON", raw }, { status: 500 });
  }

  const validArchetypes = parsed.archetypes.filter((k): k is AnimalKey =>
    ANIMAL_KEYS.includes(k as AnimalKey)
  );

  if (validArchetypes.length === 0) {
    return NextResponse.json({ error: "AI returned no valid archetypes", raw }, { status: 500 });
  }

  const updated = await prisma.profile.update({
    where: { id: profile.id },
    data: {
      animalArchetypes: JSON.stringify(validArchetypes),
      archetypeAnalysis: parsed.analysis,
      archetypeUpdatedAt: new Date(),
    },
    select: { animalArchetypes: true, archetypeAnalysis: true, archetypeUpdatedAt: true },
  });

  return NextResponse.json({ archetypes: validArchetypes, analysis: parsed.analysis, updatedAt: updated.archetypeUpdatedAt });
}
