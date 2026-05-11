import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_URL =
  process.env.NEXT_PUBLIC_AUTH_URL ?? "https://goal-app-3.onrender.com";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // NextAuth v5 sets this cookie in prod (HTTPS) or without __Secure- in dev
  const hasSession =
    req.cookies.has("__Secure-authjs.session-token") ||
    req.cookies.has("authjs.session-token");

  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/quiz") ||
    pathname.startsWith("/onboarding");

  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL("/login", PUBLIC_URL));
  }

  if (hasSession && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/dashboard", PUBLIC_URL));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)" ],
};
