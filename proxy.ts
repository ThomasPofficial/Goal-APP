import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

const SKIP_GATE = ["/onboarding", "/quiz", "/api/", "/_next", "/favicon.ico", "/login", "/register"];
const GATED = ["/dashboard", "/peers", "/orgs", "/teams", "/messages", "/profile"];

function skipsGate(pathname: string) {
  return SKIP_GATE.some((p) => pathname.startsWith(p));
}

function isGated(pathname: string) {
  return GATED.some((p) => pathname.startsWith(p));
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Require an actual user id — req.auth can be truthy-but-empty in NextAuth v5 beta
  const isLoggedIn = !!(req.auth?.user?.id);

  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/quiz") ||
    pathname.startsWith("/onboarding");

  if (!isLoggedIn && !isPublic) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn) {
    if (pathname === "/login" || pathname === "/register") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    if (isGated(pathname) && !skipsGate(pathname)) {
      const geniusType = req.auth!.user?.geniusType;
      const onboardingComplete = req.auth!.user?.onboardingComplete;

      if (!geniusType) {
        return NextResponse.redirect(new URL("/quiz", req.url));
      }
      if (!onboardingComplete) {
        return NextResponse.redirect(new URL("/onboarding", req.url));
      }
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
