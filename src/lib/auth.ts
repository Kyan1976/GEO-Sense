import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import Membership from "@/models/Membership";
import { rateLimit } from "@/lib/rate-limit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        // 审计 I9：按 email 限流登录（10 次/15 分钟），防暴力破解
        // 注：NextAuth credentials 回调无法获取请求 IP，故按 email 维度
        const rl = rateLimit(`login:${String(credentials.email).toLowerCase()}`, 10, 15 * 60 * 1000);
        if (!rl.allowed) {
          throw new Error("登录尝试过于频繁，请稍后再试");
        }

        await connectToDatabase();
        // 审计 I10：password 字段 select:false，这里显式取回
        const user = await User.findOne({ email: credentials.email }).select("+password");

        if (!user || !user.password) {
          throw new Error("Invalid email or password");
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isValid) {
          throw new Error("Invalid email or password");
        }

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          image: user.image,
          // 审计 I3：携带改密时间戳，供 jwt 回调校验 token 是否过期
          passwordChangedAt: user.passwordChangedAt,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // 审计 I3：记录改密时间，用于 token 旋转校验
        const pwdChanged = (user as { passwordChangedAt?: Date }).passwordChangedAt;
        if (pwdChanged) {
          token.passwordChangedAt = pwdChanged.getTime();
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        // 每请求查 activeWorkspaceId（回退 I2：jwt 下沉导致 activeWorkspaceId 未正确传播）
        await connectToDatabase();
        const membership = await Membership.findOne({
          userId: token.id as string,
        }).sort({ createdAt: 1 });
        if (membership) {
          session.activeWorkspaceId = membership.workspaceId.toString();
        }
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  // IP/自定义域名访问必须信任 host（NextAuth v5 默认只信任 localhost/官方域名）
  trustHost: true,
});
