/**
 * Minimal Notion REST client. We don't pull in @notionhq/client because we
 * only need a couple of endpoints; keeping deps small holds the bundle down.
 *
 * Set NOTION_TOKEN (internal integration secret) and share the target
 * database with the integration in the Notion UI.
 */

const NOTION_VERSION = "2022-06-28";
const NOTION_BASE = "https://api.notion.com/v1";

function authHeaders(): HeadersInit {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("NOTION_TOKEN is not set");
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

type NotionPropertyValue =
  | { title: { text: { content: string } }[] }
  | { rich_text: { text: { content: string } }[] }
  | { email: string }
  | { url: string | null }
  | { number: number | null }
  | { select: { name: string } | null }
  | { multi_select: { name: string }[] }
  | { date: { start: string; end?: string | null } | null }
  | { checkbox: boolean };

export type NotionProperties = Record<string, NotionPropertyValue>;

export async function createNotionPage(args: {
  databaseId: string;
  properties: NotionProperties;
}): Promise<{ id: string }> {
  const res = await fetch(`${NOTION_BASE}/pages`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      parent: { database_id: args.databaseId },
      properties: args.properties,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion createPage failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { id: string };
  return { id: data.id };
}

/** Convenience helpers so callers don't have to remember Notion's shapes. */
export const N = {
  title: (value: string): NotionPropertyValue => ({
    title: [{ text: { content: value } }],
  }),
  text: (value: string): NotionPropertyValue => ({
    rich_text: [{ text: { content: value } }],
  }),
  email: (value: string): NotionPropertyValue => ({ email: value }),
  url: (value: string | null): NotionPropertyValue => ({ url: value }),
  date: (iso: string): NotionPropertyValue => ({ date: { start: iso } }),
  select: (name: string): NotionPropertyValue => ({ select: { name } }),
};
