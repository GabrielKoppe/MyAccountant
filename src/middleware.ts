import { NextResponse } from "next/server";
import NextAuth from "next-auth";

import { authConfig } from "@/server/auth/config";

const { auth } = NextAuth(authConfig);

// Rotas exclusivas de convidado: se já autenticado, redireciona para "/".
const AUTH_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email"];

// Rotas públicas acessíveis por logados E deslogados (sem redirecionar em nenhum sentido).
// A tela de aceite de convite precisa ser vista antes mesmo de existir cadastro.
const PUBLIC_ROUTES = ["/invite"];

// Nota: NÃO anotar `req` manualmente como `NextRequest & { auth: unknown }` — o endpoint MCP
// (spec 63) importa `mcp-handler`, que faz `declare global { interface Request { auth?: AuthInfo } }`.
// Uma intersecção manual aqui força `auth` a ser não-opcional (AuthInfo | undefined), o que colide
// com `NextAuthRequest.auth` (Session | null) e quebra o typecheck. Deixar o parâmetro inferir o
// tipo a partir do overload de `auth()` evita o conflito (a checagem interna do next-auth já é
// suprimida por `skipLibCheck`).
export default auth((req) => {
  const isAuthenticated = !!req.auth?.user?.id;
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
