// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Only apply middleware to protected routes
  const protectedPaths = ["/admin", "/inventory"];
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
  
  if (!isProtectedPath) {
    return NextResponse.next();
  }

  const isProd = process.env.NODE_ENV === "production";
  const tokenName = isProd ? "__Secure-next-auth.session-token" : "next-auth.session-token";
  const token = request.cookies.get(tokenName);

  if (!token) {
    return NextResponse.redirect(new URL("/auth", request.url));
  }

  // Allow the request to proceed
  // Full role check happens server-side in the components
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/inventory/:path*",
  ],
};
