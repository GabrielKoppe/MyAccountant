import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { authConfig } from "@/server/auth/config";

const { auth } = NextAuth(authConfig);

const AUTH_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email"];

export default auth((req: NextRequest & { auth: unknown }) => {
  const session = (req as NextRequest & { auth: { user?: { id?: string } } | null }).auth;
  const isAuthenticated = !!session?.user?.id;
  const pathname = req.nextUrl.pathname;

  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  if (isAuthenticated && isAuthRoute) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  if (!isAuthenticated && !isAuthRoute) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
