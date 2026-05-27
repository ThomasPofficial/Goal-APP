"use client";

import { usePostHog } from "posthog-js/react";
import { useSession } from "next-auth/react";
import { useEffect } from "react";

export default function PostHogIdentify() {
  const { data: session } = useSession();
  const ph = usePostHog();

  useEffect(() => {
    if (!ph) return;
    if (session?.user?.id) {
      ph.identify(session.user.id, {
        email: session.user.email ?? undefined,
        name: session.user.name ?? undefined,
      });
    } else {
      ph.reset();
    }
  }, [session, ph]);

  return null;
}
