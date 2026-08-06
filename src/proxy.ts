// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { rateLimitApi } from "@/lib/rate-limit";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 1. Get Authentication Token with custom cookie name
  const useSecureCookie = process.env.NEXTAUTH_URL?.startsWith("https://") ?? false;
  const cookieName = useSecureCookie ? "__Secure-__sess" : "__sess";

  const token = await getToken({ 
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: useSecureCookie,
    cookieName: cookieName,
  });

  // 2. Rate Limiting for API routes
  if (pathname.startsWith("/api") && !pathname.startsWith("/api/auth")) {
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "anonymous";
    const identifier = token?.sub || clientIp;
    const result = await rateLimitApi(identifier);

    if (!result.success) {
      return new NextResponse(
        JSON.stringify({ 
          success: false, 
          error: "Too many requests. Please try again later.",
          code: "TOO_MANY_REQUESTS" 
        }),
        { 
          status: 429, 
          headers: { 
            "Content-Type": "application/json",
            "X-RateLimit-Limit": result.limit.toString(),
            "X-RateLimit-Remaining": result.remaining.toString(),
            "X-RateLimit-Reset": result.reset.toString(),
          } 
        }
      );
    }
  }

  // 3. Authentication & Authorization Redirects
  // If trying to access /auth and token exists, redirect to dashboard
  if (pathname.startsWith("/auth") && token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Check if request is for static assets
  const isStaticFile = /\.(?:svg|png|jpg|jpeg|webp|gif|ico|css|js)$/i.test(pathname);

  // If no token and not accessing /auth, redirect to /auth
  // Excluding static files and api routes for general auth redirect
  if (!token && !pathname.startsWith("/auth") && !pathname.startsWith("/api") && !pathname.startsWith("/_next") && !isStaticFile) {
    return NextResponse.redirect(new URL("/auth", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static image files (.svg, .png, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|gif)).*)",
  ],
};

