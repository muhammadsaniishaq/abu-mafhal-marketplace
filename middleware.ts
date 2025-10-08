// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
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
