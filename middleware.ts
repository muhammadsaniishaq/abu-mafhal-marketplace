// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { initializeApp, getApps, cert } from "firebase-admin/app";

// ✅ Initialize Firebase Admin (only once)
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("token")?.value;

  // If no token, redirect to signin
  if (!token) {
    return NextResponse.redirect(new URL("/auth/signin", req.url));
  }

  try {
    const decoded = await getAuth().verifyIdToken(token);

    // 🔒 Protect admin routes
    if (req.nextUrl.pathname.startsWith("/admin")) {
      if (decoded.role !== "admin" && decoded.role !== "superadmin") {
        return NextResponse.redirect(new URL("/not-authorized", req.url));
      }
    }

    // 🔒 Protect vendor routes
    if (req.nextUrl.pathname.startsWith("/vendor")) {
      if (decoded.role !== "vendor" && decoded.role !== "admin" && decoded.role !== "superadmin") {
        return NextResponse.redirect(new URL("/not-authorized", req.url));
      }
    }

    // Buyers can only access /buyer/*
    if (req.nextUrl.pathname.startsWith("/buyer")) {
      if (decoded.role !== "buyer" && decoded.role !== "admin" && decoded.role !== "superadmin") {
        return NextResponse.redirect(new URL("/not-authorized", req.url));
      }
    }

    return NextResponse.next();
  } catch (err) {
    return NextResponse.redirect(new URL("/auth/signin", req.url));
  }
}

// ✅ Apply middleware only to these routes
export const config = {
  matcher: ["/admin/:path*", "/vendor/:path*", "/buyer/:path*"],
};
