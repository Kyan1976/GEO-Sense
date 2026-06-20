import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Membership from "@/models/Membership";
import { getPusher } from "@/lib/pusher-server";

export const runtime = 'nodejs';

/**
 * Pusher 私有频道授权端点（审计 C2）。
 *
 * 客户端订阅 private-workspace-{id} 时，pusher-js 会向此端点 POST
 * { socket_id, channel_name }。服务端校验：
 *   1. 调用方已登录（auth session）
 *   2. 调用方是该 workspace 的成员（Membership 存在）
 * 通过则用 pusher.authorizeChannel 签发 auth signature，否则 403。
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pusher = getPusher();
    if (!pusher) {
      return NextResponse.json({ error: "Real-time not configured" }, { status: 503 });
    }

    const body = await req.json();
    const socketId: string | undefined = body?.socket_id;
    const channelName: string | undefined = body?.channel_name;
    if (!socketId || !channelName) {
      return NextResponse.json({ error: "Missing socket_id or channel_name" }, { status: 400 });
    }

    // 从频道名 private-workspace-{id} 提取 workspaceId
    const match = channelName.match(/^private-workspace-(.+)$/);
    if (!match) {
      return NextResponse.json({ error: "Invalid channel name" }, { status: 400 });
    }
    const workspaceId = match[1];

    await connectToDatabase();

    // 校验当前用户是该 workspace 的成员
    const membership = await Membership.findOne({ userId: session.user.id, workspaceId });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden: not a workspace member" }, { status: 403 });
    }

    // 签发频道授权
    const authResponse = pusher.authorizeChannel(socketId, channelName);
    return NextResponse.json(authResponse);
  } catch (error) {
    console.error("Pusher auth error:", error);
    return NextResponse.json({ error: "Authorization failed" }, { status: 500 });
  }
}
