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
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/give") ||
    pathname.startsWith("/api/donations");

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
  // /orgs/new is exempted too: self-signup always creates role STUDENT with no
  // Profile row, and the only way to become ORG is to successfully POST /api/orgs
  // from that page. Gating /orgs/new behind onboarding first, combined with
  // /api/orgs rejecting org creation once onboarding is complete, would permanently
  // lock these accounts out of ever creating an org.
  // next-router-prefetch requests are also skipped: Next.js auto-prefetches every
  // <Link> in the viewport through this same middleware, and each prefetch would
  // otherwise trigger a fresh auth() + Prisma lookup — multiplying DB load on any
  // link-dense page. Only the specific prefetch header is skipped; other RSC
  // requests (client-side soft navigations) still go through the check.
  const skipOnboardingCheck =
    pathname.startsWith("/api") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/quiz") ||
    pathname.startsWith("/orgs/new") ||
    req.headers.get("next-router-prefetch") === "1" ||
    isPublic;

  if (hasSession && !skipOnboardingCheck) {
    try {
      const session = await auth();
      if (session?.user?.id) {
        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { role: true, isAlumni: true, profile: { select: { schoolId: true, onboardingComplete: true } } },
        });
        // Alumni are always Profile.schoolId: null (they're linked via AlumniSchool
        // rows instead), so the schoolId half of this check is meaningless for them —
        // exempt alumni from it rather than bouncing them to /onboarding forever.
        const needsOnboarding =
          user?.role === "STUDENT" &&
          !user.isAlumni &&
          !user.profile?.schoolId &&
          !user.profile?.onboardingComplete;
        if (needsOnboarding) {
          return NextResponse.redirect(new URL("/onboarding", req.url));
        }
      }
    } catch (err) {
      // Fail open: a transient DB hiccup (pool exhaustion, network blip) here must
      // never 500 an otherwise-authenticated request. Treat it the same as "no
      // session found" and let the request through.
      console.error("proxy: onboarding check failed, failing open", pathname, err);
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
