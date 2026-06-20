import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import Workspace from "@/models/Workspace";
import Membership from "@/models/Membership";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = 'nodejs';

// 审计 I-signup：zod 校验（email 格式 + 密码长度）
const signupSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export async function POST(req: Request) {
  try {
    // 审计 I9：按 IP 限流注册（5 次/15 分钟），防批量注册
    const ip = getClientIp(req);
    const rl = rateLimit(`signup:${ip}`, 5, 15 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "请求过于频繁，请稍后再试" },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }

    const body = await req.json();
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "输入无效：请提供有效邮箱和至少 8 位密码" },
        { status: 400 }
      );
    }
    const { name, email, password } = parsed.data;

    await connectToDatabase();

    // 审计 I-signup：邮箱已存在不返回明确的"已存在"提示（消除用户枚举）
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { error: "无法完成注册，请检查信息或使用其他邮箱" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      provider: "credentials",
    });

    const slug = `${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-workspace`;
    const workspace = await Workspace.create({
      name: `${name}'s Workspace`,
      slug: `${slug}-${Date.now()}`,
      ownerId: user._id,
    });

    await Membership.create({
      userId: user._id,
      workspaceId: workspace._id,
      role: "owner",
      joinedAt: new Date(),
    });

    return NextResponse.json(
      {
        message: "Account created successfully",
        user: { id: user._id, name: user.name, email: user.email },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "An error occurred during signup" },
      { status: 500 }
    );
  }
}
