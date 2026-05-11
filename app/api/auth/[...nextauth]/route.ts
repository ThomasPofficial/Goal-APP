import { handlers } from "@/lib/auth";
import type { NextRequest } from "next/server";

const publicUrl = new URL(
  process.env.NEXT_PUBLIC_AUTH_URL ?? "https://goal-app-3.onrender.com"
);

function withPublicHost(req: NextRequest): Request {
  const headers = new Headers(req.headers);
  headers.set("x-forwarded-host", publicUrl.host);
  headers.set("x-forwarded-proto", publicUrl.protocol.replace(":", ""));
  return new Request(req as unknown as Request, { headers });
}

export function GET(req: NextRequest) {
  return handlers.GET(withPublicHost(req));
}

export function POST(req: NextRequest) {
  return handlers.POST(withPublicHost(req));
}
