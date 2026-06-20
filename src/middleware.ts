import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * 纵深防御鉴权中间件（审计 I1）。
 *
 * 作为各 route 内部 auth() 之外的兜底层：未登录访问受保护路径时
 * 在边缘层就拦截，避免遗漏 auth() 的路由直接暴露。
 *
 * - 页面路径（/dashboard/*）未登录 → 重定向 /login
 * - API 路径（/api/workspaces/*）未登录 → 返回 401 JSON
 *
 * 公开路径（matcher 中排除）不经此中间件。
 */
const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/signup",
  "/api/auth",
  "/api/cron",
  "/api/pusher/auth",
  "/api/invite",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const session = await auth();
  if (!session?.user?.id) {
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
