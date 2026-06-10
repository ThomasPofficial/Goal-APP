/**
 * Tiny GitHub REST helper. Uses GITHUB_PAT for server-side calls. We only
 * expose what the app needs; reach for @octokit/rest if this grows.
 */

const GITHUB_BASE = "https://api.github.com";

function authHeaders(): HeadersInit {
  const token = process.env.GITHUB_PAT;
  if (!token) throw new Error("GITHUB_PAT is not set");
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

export async function createIssue(args: {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  labels?: string[];
}): Promise<{ number: number; html_url: string }> {
  const res = await fetch(
    `${GITHUB_BASE}/repos/${args.owner}/${args.repo}/issues`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        title: args.title,
        body: args.body,
        labels: args.labels,
      }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub createIssue failed (${res.status}): ${text}`);
  }
  return (await res.json()) as { number: number; html_url: string };
}

import crypto from "crypto";

/**
 * Validate a GitHub webhook signature (`X-Hub-Signature-256`). Constant-time
 * compare to avoid timing attacks.
 */
export function verifyWebhookSignature(args: {
  rawBody: string;
  signatureHeader: string | null;
  secret: string;
}): boolean {
  if (!args.signatureHeader) return false;
  const hmac = crypto
    .createHmac("sha256", args.secret)
    .update(args.rawBody)
    .digest("hex");
  const expected = `sha256=${hmac}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(args.signatureHeader);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
