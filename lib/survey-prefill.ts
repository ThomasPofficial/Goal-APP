import Anthropic from "@anthropic-ai/sdk";
import type { ProxycurlProfile } from "./proxycurl";

export type SurveyPrefill = {
  college: string | null;
  major: string | null;
  industry: string | null;
  employer: string | null;
  jobTitle: string | null;
};

export async function extractPrefill(
  profile: ProxycurlProfile
): Promise<SurveyPrefill> {
  const client = new Anthropic();
  const empty: SurveyPrefill = {
    college: null, major: null, industry: null, employer: null, jobTitle: null,
  };
  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `Extract career and education from this LinkedIn profile JSON.
Return ONLY a JSON object with keys: college, major, industry, employer, jobTitle.
Use null for any missing field. No markdown, no explanation.

${JSON.stringify(profile, null, 2)}`,
        },
      ],
    });
    const text =
      msg.content[0].type === "text" ? msg.content[0].text.trim() : "{}";
    const parsed = JSON.parse(text);
    return {
      college:  parsed.college  ?? null,
      major:    parsed.major    ?? null,
      industry: parsed.industry ?? null,
      employer: parsed.employer ?? null,
      jobTitle: parsed.jobTitle ?? null,
    };
  } catch {
    return empty;
  }
}
