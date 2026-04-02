// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  const token = await getToken({ 
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NEXTAUTH_URL?.startsWith("https://") ?? false,
  });

  // If trying to access /auth and token exists, redirect to dashboard
  if (pathname.startsWith("/auth") && token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // If no token and not accessing /auth, redirect to /auth
  // Excluding static files and api routes
  if (!token && !pathname.startsWith("/auth") && !pathname.startsWith("/api") && !pathname.startsWith("/_next")) {
    return NextResponse.redirect(new URL("/auth", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
