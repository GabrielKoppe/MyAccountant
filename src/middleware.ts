import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { authConfig } from "@/server/auth/config";

const { auth } = NextAuth(authConfig);

// Rotas exclusivas de convidado: se já autenticado, redireciona para "/".
const AUTH_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email"];

// Rotas públicas acessíveis por logados E deslogados (sem redirecionar em nenhum sentido).
// A tela de aceite de convite precisa ser vista antes mesmo de existir cadastro.
const PUBLIC_ROUTES = ["/invite"];

export default auth((req: NextRequest & { auth: unknown }) => {
  const session = (req as NextRequest & { auth: { user?: { id?: string } } | null }).auth;
  const isAuthenticated = !!session?.user?.id;
  const pathname = req.nextUrl.pathname;

  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

  if (isAuthenticated && isAuthRoute) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  if (!isAuthenticated && !isAuthRoute && !isPublicRoute) {
    const loginUrl = new URL("/login", req.nextUrl);
    // Preserva o path COM query string (ex.: ?token=...) para não perder o contexto do convite.
    loginUrl.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
