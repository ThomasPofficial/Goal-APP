import { NextResponse } from "next/server";

const spec = {
  openapi: "3.0.0",
  info: {
    title: "Nivarro Agent API",
    version: "1.0.0",
    description:
      "Search student scholars and access private org reviews. Requires a paid org API key.",
  },
  servers: [{ url: "https://goal-app-3.onrender.com" }],
  security: [{ BearerAuth: [] }],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
      },
    },
    schemas: {
      OrgReview: {
        type: "object",
        properties: {
          id: { type: "string", description: "Review ID" },
          body: { type: "string", description: "Review text written by the org" },
          createdAt: {
            type: "string",
            format: "date-time",
            description: "When the review was written",
          },
          org: {
            type: "object",
            properties: {
              name: { type: "string", description: "Name of the org that wrote the review" },
            },
            required: ["name"],
          },
          orgProject: {
            type: "object",
            properties: {
              title: { type: "string", description: "Title of the project the review is tied to" },
            },
            required: ["title"],
          },
        },
        required: ["id", "body", "createdAt", "org", "orgProject"],
      },
      TraitLink: {
        type: "object",
        properties: {
          trait: {
            type: "object",
            properties: {
              slug: { type: "string" },
              name: { type: "string" },
              category: { type: "string" },
            },
            required: ["slug", "name", "category"],
          },
        },
        required: ["trait"],
      },
      Scholar: {
        type: "object",
        properties: {
          id: { type: "string", description: "Unique profile ID" },
          displayName: { type: "string", description: "Scholar's display name" },
          handle: { type: "string", description: "Scholar's unique handle / username" },
          headline: {
            type: "string",
            nullable: true,
            description: "Short headline the scholar wrote about themselves",
          },
          bio: {
            type: "string",
            nullable: true,
            description: "Longer biography text",
          },
          strengthSummary: {
            type: "string",
            nullable: true,
            description: "AI-generated or scholar-written summary of their strengths",
          },
          avatarUrl: {
            type: "string",
            nullable: true,
            description: "URL to the scholar's avatar image",
          },
          grade: {
            type: "integer",
            nullable: true,
            description: "Grade level (9–12)",
          },
          schoolName: {
            type: "string",
            nullable: true,
            description: "Name of the scholar's school",
          },
          interests: {
            type: "string",
            nullable: true,
            description: "Comma-separated or freeform interests string",
          },
          traitLinks: {
            type: "array",
            items: { $ref: "#/components/schemas/TraitLink" },
            description: "Top traits linked to this scholar's profile",
          },
          orgReviews: {
            type: "array",
            items: { $ref: "#/components/schemas/OrgReview" },
            description:
              "Private org reviews for this scholar. Not visible to the scholar — only to authenticated orgs.",
          },
        },
        required: ["id", "displayName", "handle", "traitLinks", "orgReviews"],
      },
    },
  },
  paths: {
    "/api/agent/search": {
      post: {
        operationId: "searchScholars",
        summary: "Search scholars",
        description:
          "Search student scholars by freeform query or structured filters. Results are ranked by review count (scholars with more org reviews appear first). Returns up to 50 scholars.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  query: {
                    type: "string",
                    description:
                      "Optional freeform natural-language query matched against display name, headline, bio, and interests",
                  },
                  filters: {
                    type: "object",
                    properties: {
                      minReviews: {
                        type: "integer",
                        minimum: 0,
                        description: "Minimum number of org reviews a scholar must have",
                      },
                      grade: {
                        type: "integer",
                        minimum: 9,
                        maximum: 12,
                        description: "Filter by grade level",
                      },
                      interests: {
                        type: "array",
                        items: { type: "string" },
                        description:
                          "Keywords matched against scholar interests fields — OR logic",
                      },
                    },
                  },
                },
              },
              example: {
                query: "Go backend developer",
                filters: { minReviews: 1 },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Scholars matching the query and filters",
            headers: {
              "X-RateLimit-Remaining": {
                schema: { type: "integer" },
                description: "Remaining API calls for today",
              },
            },
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    scholars: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Scholar" },
                    },
                    total: {
                      type: "integer",
                      description: "Total number of scholars returned",
                    },
                  },
                  required: ["scholars", "total"],
                },
              },
            },
          },
          "401": {
            description: "Missing or invalid API key",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                  },
                },
                example: { error: "Unauthorized" },
              },
            },
          },
        },
      },
    },
    "/api/agent/scholar/{id}": {
      get: {
        operationId: "getScholar",
        summary: "Get a scholar by ID",
        description:
          "Returns the full profile for a specific scholar, including all org reviews and trait links.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "The scholar's profile ID",
          },
        ],
        responses: {
          "200": {
            description: "Scholar profile",
            headers: {
              "X-RateLimit-Remaining": {
                schema: { type: "integer" },
                description: "Remaining API calls for today",
              },
            },
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    scholar: { $ref: "#/components/schemas/Scholar" },
                  },
                  required: ["scholar"],
                },
              },
            },
          },
          "401": {
            description: "Missing or invalid API key",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
                },
                example: { error: "Unauthorized" },
              },
            },
          },
          "404": {
            description: "Scholar not found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
                },
                example: { error: "Scholar not found" },
              },
            },
          },
        },
      },
    },
    "/api/agent/project/{id}/candidates": {
      get: {
        operationId: "getProjectCandidates",
        summary: "Get candidates for a project",
        description:
          "Returns today's algorithmic candidate recommendations for a specific org project. The daily quota is calculated as 2× the number of open spots remaining. Candidates are ranked by prior org review track record and required-skill keyword matches. Includes full scholar profiles with org reviews.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "The org project ID",
          },
        ],
        responses: {
          "200": {
            description: "Candidate scholars for this project",
            headers: {
              "X-RateLimit-Remaining": {
                schema: { type: "integer" },
                description: "Remaining API calls for today",
              },
            },
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    candidates: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Scholar" },
                    },
                    quota: {
                      type: "object",
                      properties: {
                        used: {
                          type: "integer",
                          description: "Number of spots already filled",
                        },
                        remaining: {
                          type: "integer",
                          description: "Number of open spots still available",
                        },
                      },
                      required: ["used", "remaining"],
                    },
                  },
                  required: ["candidates", "quota"],
                },
              },
            },
          },
          "401": {
            description: "Missing or invalid API key",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
                },
                example: { error: "Unauthorized" },
              },
            },
          },
          "404": {
            description: "Project not found or not owned by this org",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
                },
                example: { error: "Project not found for this org" },
              },
            },
          },
        },
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(spec, {
    headers: { "Content-Type": "application/json" },
  });
}
