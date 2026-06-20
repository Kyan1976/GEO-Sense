import { NextRequest, NextResponse } from "next/server";

/**
 * 纵深防御鉴权中间件（审计 I1）。
 *
 * 注意：middleware 跑在 edge runtime，不能 import 含 Node 原生模块（crypto/bcrypt/mongoose）
 * 的 @/lib/auth（否则报 "edge runtime does not support crypto"）。
 * 因此这里只做轻量的 session cookie 存在性检查（不查 DB），真正的鉴权由各 route 的 auth() 完成。
 *
 * - 页面路径（/dashboard/*）无 session cookie → 重定向 /login
 * - API 路径（/api/workspaces/*）无 session cookie → 返回 401 JSON
 * - 公开路径不经此中间件
 */
const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/signup",
  "/api/auth",
  "/api/cron",
  "/api/pusher/auth",
  "/api/invite",
];

// NextAuth v5 session cookie 名（HTTP 用前者，HTTPS 用后者）
const SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function hasSessionCookie(req: NextRequest): boolean {
  return SESSION_COOKIE_NAMES.some((name) => {
    const v = req.cookies.get(name)?.value;
    return typeof v === "string" && v.length > 0;
  });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  if (!hasSessionCookie(request)) {
    // API 路径返回 401，页面路径重定向登录
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // 覆盖需鉴权的页面与 API；公开路径在 middleware 内部通过 isPublic 放行
  matcher: ["/dashboard/:path*", "/api/workspaces/:path*"],
};
