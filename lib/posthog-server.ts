import { PostHog } from "posthog-node";

let _client: PostHog | null = null;

/**
 * Server-side PostHog client. Use for capturing events from API routes,
 * server actions, and webhook handlers.
 *
 * Returns null when NEXT_PUBLIC_POSTHOG_KEY is not set so callers can
 * no-op cleanly in dev/preview environments.
 */
export function getPostHogServer(): PostHog | null {
  const key =
    process.env.POSTHOG_PROJECT_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  if (_client) return _client;
  _client = new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
  return _client;
}

export type CaptureArgs = {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
};

/**
 * Fire-and-forget capture. Resolves once the event is queued and flushed.
 * Never throws — analytics must not break product flows.
 */
export async function capture(args: CaptureArgs): Promise<void> {
  const ph = getPostHogServer();
  if (!ph) return;
  try {
    ph.capture({
      distinctId: args.distinctId,
      event: args.event,
      properties: args.properties,
    });
    await ph.flush();
  } catch (err) {
    console.error("[posthog] capture failed:", err);
  }
}
