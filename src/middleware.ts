import { NextResponse } from "next/server";
import NextAuth from "next-auth";

import { authConfig } from "@/server/auth/config";
import { loginLimiter } from "@/server/security/rate-limit";

const { auth } = NextAuth(authConfig);

// Rotas exclusivas de convidado: se já autenticado, redireciona para "/".
const AUTH_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email"];

// Rotas públicas (logado ou não) — a tela de aceite de convite precisa ser vista sem cadastro.
const PUBLIC_ROUTES = ["/invite"];

function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}

// Nota: NÃO anotar `req` manualmente (colide com o `declare global Request.auth` do mcp-handler).
export default auth(async (req) => {
  const { pathname } = req.nextUrl;

  // SEC-01: rate limit de login por IP (todas as tentativas na janela).
  if (req.method === "POST" && pathname === "/api/auth/callback/credentials") {
    const limiter = loginLimiter();
    if (limiter) {
      const { success } = await limiter.limit(`login:${clientIp(req.headers)}`);
      if (!success) {
        return NextResponse.json(
          {
            error: "TooManyRequests",
            message: "Muitas tentativas de login. Tente novamente em alguns minutos.",
          },
          { status: 429 },
        );
      }
    }
    return NextResponse.next();
  }

  // SEC-04: /api/v1 exige sessão (autenticação). Autorização de Account segue por-handler.
  if (pathname.startsWith("/api/v1/")) {
    if (!req.auth?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // ===== Fluxo de páginas (inalterado) =====
  const isAuthenticated = !!req.auth?.user?.id;
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

  if (isAuthenticated && isAuthRoute) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  if (!isAuthenticated && !isAuthRoute && !isPublicRoute) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
    "/api/v1/:path*",
    "/api/auth/callback/credentials",
  ],
};
