import Link from "next/link";

const codeBlockStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  padding: 16,
  borderRadius: 8,
  overflow: "auto",
  fontFamily: "var(--font-mono)",
  fontSize: 13,
  color: "var(--text2)",
  lineHeight: 1.6,
  whiteSpace: "pre",
};

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: "1.125rem",
  fontWeight: 600,
  marginBottom: "0.75rem",
  color: "var(--text)",
};

const curlExample = `curl -X POST https://goal-app-3.onrender.com/api/agent/search \\
  -H "Authorization: Bearer YOUR_ORG_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "Go backend developer", "filters": {"minReviews": 1}}'`;

const claudeSystemPrompt = `You have access to the Nivarro student API.
Schema: https://goal-app-3.onrender.com/api/agent/openapi.json
Your API key: [YOUR_ORG_KEY]
Use the search endpoint to find students. Reviews contain private org feedback not visible to students.`;

const mcpToolDef = JSON.stringify(
  {
    name: "nivarro",
    description: "Search Nivarro student profiles and org reviews",
    baseUrl: "https://goal-app-3.onrender.com/api/agent",
    auth: { type: "bearer", key: "[YOUR_ORG_KEY]" },
    tools: [
      { name: "search_scholars", method: "POST", path: "/search" },
      { name: "get_scholar", method: "GET", path: "/scholar/{id}" },
      { name: "get_candidates", method: "GET", path: "/project/{id}/candidates" },
    ],
  },
  null,
  2
);

export default function AgentApiDocsPage() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-6">
      {/* Header */}
      <div style={{ marginBottom: "2.5rem" }}>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "2.25rem",
            fontWeight: 600,
            color: "var(--text)",
            marginBottom: "0.5rem",
          }}
        >
          Nivarro Agent API
        </h1>
        <p style={{ color: "var(--text2)", fontSize: "1.05rem" }}>
          Give AI agents access to student profiles and private org reviews.
        </p>
      </div>

      {/* Get your API key */}
      <div
        className="bracket-card"
        style={{
          background: "rgba(59,130,246,0.08)",
          border: "1px solid rgba(59,130,246,0.25)",
          borderRadius: 8,
          padding: "1rem 1.25rem",
          marginBottom: "2.5rem",
          color: "var(--text2)",
          fontSize: "0.9375rem",
        }}
      >
        <span style={{ color: "var(--blue)", fontWeight: 600 }}>Get your API key — </span>
        Generate your API key from your org dashboard → Overview → API Key. Contact{" "}
        <a
          href="mailto:team.nivarro@gmail.com"
          style={{ color: "var(--blue)", textDecoration: "underline" }}
        >
          team.nivarro@gmail.com
        </a>{" "}
        if you need help.
      </div>

      {/* What this API unlocks */}
      <section style={{ marginBottom: "2.5rem" }}>
        <h2 style={sectionHeadingStyle}>What this API unlocks</h2>
        <p style={{ color: "var(--text2)", lineHeight: 1.7, fontSize: "0.9375rem" }}>
          Org API keys give access to student profiles including{" "}
          <strong style={{ color: "var(--text)" }}>private org reviews</strong> — feedback written
          by other organizations that worked with each student. This data is not visible on public
          profiles. It is only accessible to authenticated orgs via this API.
        </p>
      </section>

      {/* Use with Claude */}
      <section style={{ marginBottom: "2.5rem" }}>
        <h2 style={sectionHeadingStyle}>Use with Claude</h2>
        <p style={{ color: "var(--text2)", marginBottom: "0.75rem", fontSize: "0.9375rem" }}>
          Paste this as a system prompt in Claude or Claude API calls:
        </p>
        <pre style={codeBlockStyle}>{claudeSystemPrompt}</pre>
      </section>

      {/* Use with ChatGPT Actions */}
      <section style={{ marginBottom: "2.5rem" }}>
        <h2 style={sectionHeadingStyle}>Use with ChatGPT Actions</h2>
        <p style={{ color: "var(--text2)", marginBottom: "0.75rem", fontSize: "0.9375rem" }}>
          Paste this URL into the GPT Actions config to import the full schema:
        </p>
        <pre style={codeBlockStyle}>
          {"https://goal-app-3.onrender.com/api/agent/openapi.json"}
        </pre>
      </section>

      {/* Use with MCP */}
      <section style={{ marginBottom: "2.5rem" }}>
        <h2 style={sectionHeadingStyle}>Use with MCP</h2>
        <p style={{ color: "var(--text2)", marginBottom: "0.75rem", fontSize: "0.9375rem" }}>
          Register Nivarro as an MCP tool using this definition:
        </p>
        <pre style={codeBlockStyle}>{mcpToolDef}</pre>
      </section>

      {/* Live example */}
      <section style={{ marginBottom: "2.5rem" }}>
        <h2 style={sectionHeadingStyle}>Live example</h2>
        <p style={{ color: "var(--text2)", marginBottom: "0.75rem", fontSize: "0.9375rem" }}>
          Search for scholars directly from the command line:
        </p>
        <pre style={codeBlockStyle}>{curlExample}</pre>
      </section>

      {/* Privacy model */}
      <section style={{ marginBottom: "2.5rem" }}>
        <h2 style={sectionHeadingStyle}>Privacy model</h2>
        <ul
          style={{
            color: "var(--text2)",
            fontSize: "0.9375rem",
            lineHeight: 1.8,
            paddingLeft: "1.25rem",
            listStyleType: "disc",
          }}
        >
          <li>Reviews are written by orgs, invisible to students</li>
          <li>Students know they have reviews but cannot read them</li>
          <li>Org API keys are scoped to the org — one key per org</li>
          <li>All requests are rate-limited to 100/day; abuse = key revoked</li>
        </ul>
      </section>

      {/* Footer link */}
      <div
        style={{
          borderTop: "1px solid var(--border)",
          paddingTop: "1.5rem",
          marginTop: "1rem",
        }}
      >
        <Link
          href="/api/agent/openapi.json"
          style={{
            color: "var(--blue)",
            fontSize: "0.9375rem",
            textDecoration: "none",
            fontFamily: "var(--font-mono)",
          }}
        >
          View OpenAPI spec →
        </Link>
      </div>
    </div>
  );
}
