import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function proxy(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  const { pathname } = req.nextUrl;

  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/quiz") ||
    pathname.startsWith("/onboarding");

  const base =
    process.env.NEXT_PUBLIC_AUTH_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    `${req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "")}://${req.headers.get("x-forwarded-host") ?? req.nextUrl.host}`;

  if (!token && !isPublic) {
    return NextResponse.redirect(new URL("/login", base));
  }

  if (token && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/dashboard", base));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
