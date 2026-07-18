import type { ImageParams } from "@/components/campaigns/CampaignCanvas";

export interface CampaignContent {
  headline: string;
  subheadline: string;
  body: string;
  ctaText: string;
  imageParams: ImageParams;
}

const RESPONSE_SHAPE = `{
  "headline": "6-12 word headline naming the concrete ask or stakes",
  "subheadline": "one sentence citing a specific, credible detail from the cause (a number, place, or deadline)",
  "body": "3-4 paragraphs separated by \\n\\n: the concrete situation, why it matters now, exactly what the funds buy, then a direct ask",
  "ctaText": "3-6 word call-to-action implying urgency or specificity, e.g. Fund Our Trip to Dallas",
  "imageParams": {
    "seed": <random integer 1000-9999>,
    "bg": "<dark or light hex color matching the cause's mood>",
    "palette": ["<hex1>", "<hex2>", "<hex3>", "<hex4>"],
    "accent": "<most vibrant of the palette hexes>",
    "layers": [
      {
        "type": "<one of: geometric|wave|burst|organic>",
        "blend": "<one of: normal|screen|multiply|overlay>",
        "density": <float 0-1>,
        "scale": <float 0.5-2>,
        "opacity": <float 0-1>,
        "rotation": <integer 0-360>,
        "paletteOffset": <integer 0-3>
      }
    ],
    "grain": <float 0-1>,
    "glow": <float 0-1>
  }
}`;

const MOOD_GUIDANCE = `Visual mood guidance — pick your own exact numeric values within these directions, do not just copy an example, and feel free to combine dimensions in ways not listed below so different causes don't converge on the same look:
- Energetic/vibrant causes (sports, competitions, performances): 2-3 layers, blend "screen" or "overlay", higher glow (0.5-0.9), moderate-to-high density, warm/bold palette.
- Intimate/documentary causes (community stories, individual hardship): 1 layer, type "organic", higher grain (0.4-0.7), low glow (0-0.2), muted palette.
- Confident/minimal causes (academic, robotics, tech): 1 layer, low density (0.1-0.3), low grain, low-to-moderate glow, one strong accent color against a near-neutral background.
- Calm/environmental causes (nature, water, sustainability): 1-2 layers, type "wave" or "organic", cool palette, low-to-moderate glow, low grain.`;

export function buildGeneratePrompt(cause: string): string {
  return `You are a fundraising copywriter and visual designer for student organizations. Write compelling, persuasive donation page copy AND choose visual design parameters for this cause:

"${cause}"

Write like an experienced fundraising copywriter, not a generic template: use concrete specifics from the cause description (names, numbers, places, deadlines) rather than vague enthusiasm, build a real emotional stake, and make the ask feel urgent and exact.

Respond ONLY with valid JSON (no markdown, no code fences):
${RESPONSE_SHAPE}

${MOOD_GUIDANCE}`;
}

export function buildTweakPrompt(current: CampaignContent, feedback: string): string {
  return `You are revising an existing student-organization fundraising page based on feedback. Here is the current page content and visual parameters as JSON:

${JSON.stringify(
  {
    headline: current.headline,
    subheadline: current.subheadline,
    body: current.body,
    ctaText: current.ctaText,
    imageParams: current.imageParams,
  },
  null,
  2
)}

User feedback: "${feedback}"

Revise ONLY what the feedback implies should change. Preserve every other field exactly as-is, character for character — including imageParams — unless the feedback specifically references colors, mood, or visuals. Keep the same persuasive, concrete fundraising-copywriter voice as the original.

Respond ONLY with valid JSON in this exact shape (no markdown, no code fences):
${RESPONSE_SHAPE}`;
}

export function parseCampaignResponse(rawText: string): CampaignContent | null {
  const cleaned = rawText.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  const required = ["headline", "subheadline", "body", "ctaText", "imageParams"];
  if (required.some((k) => !parsed[k])) return null;
  return {
    headline: parsed.headline as string,
    subheadline: parsed.subheadline as string,
    body: parsed.body as string,
    ctaText: parsed.ctaText as string,
    imageParams: parsed.imageParams as ImageParams,
  };
}
