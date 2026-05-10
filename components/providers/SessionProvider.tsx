"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

export default function SessionProvider({ children }: { children: React.ReactNode }) {
  const baseUrl = process.env.NEXT_PUBLIC_AUTH_URL ?? "";
  return <NextAuthSessionProvider basePath={`${baseUrl}/api/auth`}>{children}</NextAuthSessionProvider>;
}
