import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import * as cheerio from "cheerio";
import { getResendClient } from "@/lib/resend";

// .edu domains only — legal safety constraint
const SOURCES = [
  { institution: "Stanford Compression Forum", url: "https://compression.stanford.edu/programs" },
  { institution: "MIT PRIMES", url: "https://math.mit.edu/research/highschool/primes/index.php" },
  { institution: "Carnegie Mellon Pre-College", url: "https://www.cmu.edu/pre-college/" },
  { institution: "UPenn Wharton Global Youth", url: "https://globalyouth.wharton.upenn.edu/" },
];

async function scrapeUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Nivarro-Bot/1.0 (educational opportunity aggregator; contact team@nivarro.co)" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  $("nav, footer, script, style, .nav, .footer, header").remove();
  return $("main, article, .content, body").first().text().replace(/\s+/g, " ").trim().slice(0, 3000);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== "niv-reset-2026") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const newListings: { institution: string; title: string; url: string; confidence: number; summary: string }[] = [];

  for (const source of SOURCES) {
    let pageText: string;
    try {
      pageText = await scrapeUrl(source.url);
    } catch (e) {
      console.error(`Failed to scrape ${source.url}:`, e);
      continue;
    }

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `You are screening web pages for legitimate student opportunity listings from educational institutions.

Institution: ${source.institution}
URL: ${source.url}
Page content: ${pageText}

Answer in JSON only:
{
  "isOpportunity": true/false,
  "confidence": 0.0-1.0,
  "title": "program name if found",
  "deadline": "deadline if found, else null",
  "summary": "1-2 sentence summary for review queue",
  "reason": "why approved or rejected"
}

Approve only if: clearly a student program/research opportunity, from the stated institution, has actionable information. Reject if: generic marketing page, no program details, or unrelated.`,
        },
      ],
    });

    let parsed: { isOpportunity: boolean; confidence: number; title: string; deadline: string | null; summary: string } | null = null;
    try {
      const text = message.content[0].type === "text" ? message.content[0].text : "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {
      continue;
    }

    if (!parsed || !parsed.isOpportunity || parsed.confidence < 0.7) continue;

    const exists = await prisma.scrapedListing.findFirst({
      where: { sourceUrl: source.url, title: parsed.title },
    });
    if (exists) continue;

    const listing = await prisma.scrapedListing.create({
      data: {
        sourceUrl: source.url,
        sourceInstitution: source.institution,
        title: parsed.title ?? "Untitled Program",
        rawDescription: pageText.slice(0, 1000),
        deadline: parsed.deadline,
        aiSummary: parsed.summary,
        aiConfidence: parsed.confidence,
        status: "PENDING",
      },
    });

    newListings.push({
      institution: source.institution,
      title: listing.title,
      url: source.url,
      confidence: parsed.confidence,
      summary: parsed.summary ?? "",
    });
  }

  if (newListings.length === 0) {
    return NextResponse.json({ found: 0, message: "No new listings found" });
  }

  const resend = getResendClient();
  const listHtml = newListings
    .map(
      (l) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #eee"><strong>${l.title}</strong><br/><small>${l.institution}</small></td>
          <td style="padding:8px;border-bottom:1px solid #eee">${(l.confidence * 100).toFixed(0)}%</td>
          <td style="padding:8px;border-bottom:1px solid #eee">${l.summary}</td>
        </tr>`
    )
    .join("");

  await resend.emails.send({
    from: "Nivarro Scraper <noreply@nivarro.co>",
    to: "team@nivarro.co",
    subject: `[Nivarro Scraper] ${newListings.length} new listing${newListings.length > 1 ? "s" : ""} found — review required`,
    html: `
      <h2>Scraper found ${newListings.length} new listing${newListings.length > 1 ? "s" : ""}</h2>
      <p>Review and approve at: <a href="https://app.nivarro.co/admin/scraper-queue">app.nivarro.co/admin/scraper-queue</a></p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #eee">Program</th>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #eee">AI Confidence</th>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #eee">Summary</th>
          </tr>
        </thead>
        <tbody>${listHtml}</tbody>
      </table>
    `,
  });

  return NextResponse.json({ found: newListings.length, listings: newListings });
}
