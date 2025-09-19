import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';


export async function middleware(req: NextRequest) {
if (!req.nextUrl.pathname.startsWith('/admin')) return NextResponse.next();


const token = req.cookies.get('__session'); // set this after login with ID token
if (!token) return NextResponse.redirect(new URL('/auth/sign-in', req.url));


// Optionally verify role via a lightweight endpoint or encrypted cookie claims
// For brevity, assume presence of token is enough; in production, verify custom claims
return NextResponse.next();
}