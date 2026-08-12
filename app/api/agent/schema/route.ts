import { NextResponse } from "next/server";

// GET /api/agent/schema — open schema for OpenClaw, Claude, and other agents
// No auth required — schema is public so agent builders can target it directly
export async function GET() {
  return NextResponse.json({
    version: "1.0",
    description: "Nivarro Agent API — search scholars, read profiles, and get project candidates.",
    auth: {
      type: "Bearer",
      header: "Authorization",
      note: "Requires a paid org API key. Contact team.nivarro@gmail.com to obtain one.",
    },
    rateLimit: "100 requests/day per paid org",
    endpoints: [
      {
        path: "/api/agent/search",
        method: "POST",
        description: "Search scholars by freeform query or structured filters. Returns ranked list with reviews.",
        body: {
          query: "string — optional freeform natural-language query",
          filters: {
            minReviews: "number — minimum review count",
            grade: "number — 9-12",
            interests: "string[] — keywords to match against scholar interests",
          },
        },
      },
      {
        path: "/api/agent/scholar/:id",
        method: "GET",
        description: "Full scholar profile + all reviews for a specific scholar.",
        params: { id: "Profile ID" },
      },
      {
        path: "/api/agent/project/:id/candidates",
        method: "GET",
        description: "Today's algorithm recommendations for a project. Respects daily quota, returns with reviews.",
        params: { id: "OrgProject ID" },
      },
    ],
  });
}
