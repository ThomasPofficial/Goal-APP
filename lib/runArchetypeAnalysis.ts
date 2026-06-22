import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { ANIMAL_ARCHETYPES, ANIMAL_KEYS, type AnimalKey } from "@/lib/animalArchetypes";

export const ARCHETYPE_MIN_REVIEWS = 3;
export const ARCHETYPE_MIN_WORDS = 240;

const anthropic = new Anthropic();

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export async function runArchetypeAnalysis(profileId: string): Promise<{
  archetypes: AnimalKey[];
  analysis: string;
  updatedAt: Date;
} | null> {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    include: {
      user: { select: { id: true } },
      orgReviews: { select: { body: true, createdAt: true, org: { select: { name: true } } } },
    },
  });

  if (!profile) return null;

  const qualifyingReviews = profile.orgReviews.filter(
    (r) => wordCount(r.body) >= ARCHETYPE_MIN_WORDS
  );

  if (qualifyingReviews.length < ARCHETYPE_MIN_REVIEWS) return null;

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
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const parsed: { archetypes: string[]; analysis: string } = JSON.parse(
    jsonMatch ? jsonMatch[0] : raw
  );

  const validArchetypes = parsed.archetypes.filter((k): k is AnimalKey =>
    ANIMAL_KEYS.includes(k as AnimalKey)
  );

  if (validArchetypes.length === 0) throw new Error("AI returned no valid archetypes");

  const updated = await prisma.profile.update({
    where: { id: profileId },
    data: {
      animalArchetypes: JSON.stringify(validArchetypes),
      archetypeAnalysis: parsed.analysis,
      archetypeUpdatedAt: new Date(),
    },
    select: { archetypeUpdatedAt: true },
  });

  return {
    archetypes: validArchetypes,
    analysis: parsed.analysis,
    updatedAt: updated.archetypeUpdatedAt!,
  };
}
