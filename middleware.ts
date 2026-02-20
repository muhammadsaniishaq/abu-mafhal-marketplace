// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const ua = req.headers.get("user-agent") || "";
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

  // 1. Mobile Redirection
  if (isMobile && !req.nextUrl.pathname.startsWith("/mobile") && !req.nextUrl.searchParams.has("force")) {
    return NextResponse.redirect(new URL("/mobile", req.url));
  }

  const role = req.cookies.get("role")?.value; // set this after login

  if (req.nextUrl.pathname.startsWith("/dashboard/admin") && role !== "admin") {
    return NextResponse.redirect(new URL("/(auth)/login", req.url));
  }
  if (req.nextUrl.pathname.startsWith("/dashboard/vendor") && role !== "vendor") {
    return NextResponse.redirect(new URL("/(auth)/login", req.url));
  }
  if (req.nextUrl.pathname.startsWith("/dashboard/buyer") && role !== "buyer") {
    return NextResponse.redirect(new URL("/(auth)/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
