import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { TRAIT_QUIZ_QUESTIONS } from "@/data/traitQuiz";
import { TRAITS } from "@/data/traits";

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { answers } = body as { answers: number[] };

  if (
    !Array.isArray(answers) ||
    answers.length !== TRAIT_QUIZ_QUESTIONS.length
  ) {
    return NextResponse.json({ error: "Invalid answers" }, { status: 400 });
  }

  // ── Step 1: Score all traits ──────────────────
  const scores: Record<string, number> = {};
  for (let i = 0; i < answers.length; i++) {
    const question = TRAIT_QUIZ_QUESTIONS[i];
    const option = question.options[answers[i]];
    if (!option) continue;
    for (const [slug, weight] of Object.entries(option.weights)) {
      scores[slug] = (scores[slug] ?? 0) + (weight ?? 0);
    }
  }

  // ── Step 2: Top 10 by score ───────────────────
  const sortedSlugs = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([slug]) => slug);

  const top10Traits = sortedSlugs
    .map((slug) => TRAITS.find((t) => t.slug === slug))
    .filter(Boolean);

  // ── Step 3: Build answer context for Claude ───
  const answerContext = TRAIT_QUIZ_QUESTIONS.map((q, i) => {
    const chosen = q.options[answers[i]];
    return `Q${i + 1} [${q.cluster}]: "${q.question}"\nAnswer: "${chosen?.text ?? "unknown"}"`;
  }).join("\n\n");

  // ── Step 4: Call Claude (hybrid analysis) ────
  let selectedSlugs: string[] = [];
  let explanation = "";

  try {
    const message = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      thinking: { type: "adaptive" },
      system: `You are an honest, rigorous personality analyst for Nivarro — a professional platform built around team dynamics and authentic strengths.

Your job is to select exactly 5 traits that most accurately describe this user based on their quiz answers.

RULES:
- Prioritize honesty over flattery. The goal is accurate self-understanding, not validation.
- Pick traits that genuinely emerge from the answers — avoid generic or aspirational selections.
- Ground your explanation in specific answer patterns, not generalities.
- If someone's answers show a risk-taker pattern, call it that — don't soften it to "calculated risk-taker" unless the evidence supports it.
- The explanation should be 2–3 sentences. Be direct. Users should feel accurately seen, not complimented.`,
      messages: [
        {
          role: "user",
          content: `Here are the user's answers to 15 behavioral questions:\n\n${answerContext}\n\n---\n\nBased on scoring, the top 10 candidate traits are:\n${top10Traits
            .map(
              (t, i) =>
                `${i + 1}. ${t!.name} (${t!.category}) — ${t!.description}`
            )
            .join(
              "\n"
            )}\n\n---\n\nSelect exactly 5 traits from the candidates above that most accurately describe this user. Return ONLY valid JSON in this exact format:\n\n{\n  "selectedSlugs": ["slug1", "slug2", "slug3", "slug4", "slug5"],\n  "explanation": "2-3 honest sentences grounded in specific answer patterns."\n}`,
        },
      ],
    });

    for (const block of message.content) {
      if (block.type === "text") {
        try {
          const jsonMatch = block.text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            selectedSlugs = parsed.selectedSlugs ?? [];
            explanation = parsed.explanation ?? "";
          }
        } catch {
          // fallback handled below
        }
      }
    }
  } catch (err) {
    console.error("Claude API error:", err);
  }

  // ── Step 5: Validate + fill gaps ─────────────
  selectedSlugs = selectedSlugs
    .filter((s) => sortedSlugs.includes(s))
    .slice(0, 5);

  if (selectedSlugs.length < 5) {
    for (const slug of sortedSlugs) {
      if (!selectedSlugs.includes(slug)) {
        selectedSlugs.push(slug);
        if (selectedSlugs.length === 5) break;
      }
    }
  }

  if (!explanation) {
    explanation =
      "Based on your answers, these traits consistently reflect how you think, work, and collaborate.";
  }

  // ── Step 6: Fetch DB trait IDs ────────────────
  const dbTraits = await prisma.trait.findMany({
    where: { slug: { in: selectedSlugs } },
    select: { id: true, slug: true, name: true, category: true },
  });

  const orderedTraits = selectedSlugs
    .map((slug) => dbTraits.find((t) => t.slug === slug))
    .filter(Boolean);

  return NextResponse.json({
    traitSlugs: selectedSlugs,
    traitIds: orderedTraits.map((t) => t!.id),
    traitData: orderedTraits,
    explanation,
  });
}
