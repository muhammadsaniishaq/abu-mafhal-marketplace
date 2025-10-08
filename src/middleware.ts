import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req });
  
  const path = req.nextUrl.pathname;

  // Protect admin dashboard
  if (path.startsWith("/dashboard/admin")) {
    if (!token || token.role !== "admin") {
      return NextResponse.redirect(new URL("/(auth)/login", req.url));
    }
  }

  // Protect vendor dashboard
  if (path.startsWith("/dashboard/vendor")) {
    if (!token || token.role !== "vendor") {
      return NextResponse.redirect(new URL("/(auth)/login", req.url));
    }
  }

  // Protect buyer dashboard
  if (path.startsWith("/dashboard/buyer")) {
    if (!token || token.role !== "buyer") {
      return NextResponse.redirect(new URL("/(auth)/login", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
