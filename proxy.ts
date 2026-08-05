import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function proxy(req: NextRequest) {
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
    pathname.startsWith("/demo") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/quiz") ||
    pathname.startsWith("/onboarding");

  // Redirect relative to the incoming request's own origin (req.url), never an
  // env-configured external URL. NEXT_PUBLIC_AUTH_URL can drift out of sync with
  // the domain actually serving the request (e.g. still pointing at the raw
  // *.onrender.com host after a custom domain was added) — that mismatch bounces
  // the browser across origins mid-redirect, which splits the session cookie
  // across two domains and makes a freshly-logged-in user see a stale session
  // from whichever domain still has an old cookie.
  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (hasSession && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Force standard (self-signup, non-walled) students to finish /onboarding before
  // using the rest of the app. Walled students (added via school roster CSV import)
  // already get onboardingComplete:true stamped at import time, and every non-STUDENT
  // role (ORG/SCHOOL/ADMIN) is untouched by this check. /api/* is exempted even though
  // it's not in isPublic — an API route redirected to an HTML page instead of JSON
  // would silently break the onboarding page's own PATCH /api/profile call.
  const skipOnboardingCheck =
    pathname.startsWith("/api") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/quiz") ||
    isPublic;

  if (hasSession && !skipOnboardingCheck) {
    const session = await auth();
    if (session?.user?.id) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, profile: { select: { schoolId: true, onboardingComplete: true } } },
      });
      const needsOnboarding =
        user?.role === "STUDENT" && !user.profile?.schoolId && !user.profile?.onboardingComplete;
      if (needsOnboarding) {
        return NextResponse.redirect(new URL("/onboarding", req.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  // Files under /public are served from the site root (e.g. /ops-room.png), not
  // under a "/public/" prefix, so excluding "public/" here never matched anything —
  // static assets were getting bounced through the auth redirect above. Exclude by
  // extension instead so images/fonts/etc. actually skip the proxy.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|avif|ico|css|js|woff2?|ttf|map)$).*)"],
};
