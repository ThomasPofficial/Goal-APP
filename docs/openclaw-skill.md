# Nivarro Scholar Search — OpenClaw Skill

## What this skill does

Search the Nivarro platform for high school scholars matching your project's needs.
Nivarro is a talent platform where scholars build teams and apply to verified org projects.
You can search by genius type, interests, grade level, and minimum review count.
Reviews are written by orgs after project completion — they are the data moat.

## Auth

All requests require a paid-org API key in the Authorization header:

```
Authorization: Bearer niv_<your-api-key>
```

API keys are issued by the Nivarro team. Contact team.nivarro@gmail.com.

Rate limit: 100 API calls per day. The response includes `X-RateLimit-Remaining`.

## Base URL

```
https://nivarro.co
```

## Endpoints

### 1. Search scholars

`POST /api/agent/search`

Find scholars matching a query or structured filters. Returns up to 50 results, ranked by review count (most reviewed first).

Request body (all fields optional):
```json
{
  "query": "machine learning Python",
  "filters": {
    "geniusType": "STEEL",
    "minReviews": 1,
    "grade": 11,
    "interests": ["research", "data science"]
  }
}
```

Genius types: `STEEL` (analytical/systematic), `BLAZE` (creative/bold), `DYNAMO` (energetic/driven), `TEMPO` (steady/reliable).

Response:
```json
{
  "scholars": [
    {
      "id": "clxxx",
      "displayName": "Priya Sharma",
      "handle": "priya-s",
      "headline": "ML researcher + hackathon finalist",
      "geniusType": "STEEL",
      "grade": 11,
      "interests": "[\"machine learning\",\"Python\",\"research\"]",
      "orgReviews": [
        {
          "body": "Priya delivered a working prototype ahead of schedule...",
          "createdAt": "2026-03-01T00:00:00.000Z",
          "org": { "name": "Research Cohort" },
          "orgProject": { "title": "AI Climate Study" }
        }
      ]
    }
  ],
  "total": 1
}
```

### 2. Get full scholar profile

`GET /api/agent/scholar/:id`

Full profile + all reviews for a specific scholar. Use `id` from search results.

Response:
```json
{
  "scholar": {
    "id": "clxxx",
    "displayName": "Priya Sharma",
    "bio": "...",
    "strengthSummary": "...",
    "geniusType": "STEEL",
    "grade": 11,
    "isFirstGen": true,
    "traitLinks": [
      { "trait": { "slug": "analytical", "name": "Analytical", "category": "ANALYTICAL" } }
    ],
    "orgReviews": []
  }
}
```

### 3. Get project candidates

`GET /api/agent/project/:id/candidates`

Today's algorithm-recommended candidates for a specific project. Number of results = (open spots remaining) × 2. Preferred genius types surface first.

Response:
```json
{
  "candidates": [],
  "quota": {
    "dailyCap": 6,
    "resetsAt": "2026-05-22T00:00:00.000Z"
  },
  "exhausted": false
}
```

### 4. Get API schema

`GET /api/agent/schema`

No auth required. Returns the machine-readable schema for all endpoints.

## Example OpenClaw workflow

```
1. POST /api/agent/search with { query: "biology research", filters: { minReviews: 1 } }
2. Review top 3 results. For each, GET /api/agent/scholar/:id for full review text.
3. Build a shortlist. Return it to the user with scholar IDs, names, and review excerpts.
```

## Error codes

| Status | Meaning |
|--------|---------|
| 401 | Missing or invalid API key |
| 403 | Org is not on paid tier |
| 404 | Scholar or project not found |
| 429 | Rate limit exceeded — check `resetsAt` in response body |
