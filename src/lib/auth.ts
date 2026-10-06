import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// Эрх (role), идэвхтэй эсэхийг DB-ээс дахин шалгах давтамж
const ROLE_SYNC_MS = 5 * 60 * 1000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = String(credentials.email).trim().toLowerCase();
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user || !user.isActive || !user.passwordHash) return null;

        const isValid = await bcrypt.compare(
          String(credentials.password),
          user.passwordHash,
        );

        if (!isValid) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.nickname,
          image: user.avatarUrl,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google" || !user.email) return true;

      const email = user.email.trim().toLowerCase();
      const existingUser = await prisma.user.findUnique({ where: { email } });

      // Шинэ хүн шууд нэвтрэхгүй — admin "Идэвхжүүлэх" дарах хүртэл хүлээнэ.
      // Хүлээгдэж буй = идэвхгүй + нэг ч удаа нэвтрээгүй (lastLoginAt хоосон).
      if (!existingUser) {
        await prisma.user.create({
          data: {
            email,
            nickname: null,
            avatarUrl: user.image ?? null,
            passwordHash: "",
            role: "ENGINEER",
            isActive: false,
          },
        });
        return "/login?status=pending";
      }

      if (!existingUser.isActive) {
        return existingUser.lastLoginAt
          ? "/login?status=blocked"
          : "/login?status=pending";
      }

      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          avatarUrl: user.image ?? null,
          lastLoginAt: new Date(),
        },
      });

      return true;
    },

    // ── JWT callback ──────────────────────────────────────────────────────────
    // Session шалгах бүрт DB query хийхгүй — зөвхөн шинэ login, session.update()
    // эсвэл сүүлд шалгаснаас хойш ROLE_SYNC_MS өнгөрсөн үед DB-ээс уншина.
    // Ингэснээр admin эрх олгох/хасах, хэрэглэгч хаах нь дахин нэвтрэхгүйгээр
    // хэдэн минутын дотор хэрэгжинэ.
    async jwt({ token, user, trigger }) {
      const syncedAt = typeof token.syncedAt === "number" ? token.syncedAt : 0;
      const stale = Date.now() - syncedAt > ROLE_SYNC_MS;

      if (user || trigger === "update" || stale) {
        let dbUser;
        try {
          dbUser = await prisma.user.findUnique({
            where: { email: token.email! },
            select: {
              id: true,
              role: true,
              nickname: true,
              avatarUrl: true,
              isActive: true,
            },
          });
        } catch (error) {
          // DB түр тасарсан бол бүх хүнийг гаргахгүй — дараагийн удаа дахин шалгана
          if (user) throw error;
          console.error("Session role sync failed:", error);
          return token;
        }

        // Устгагдсан эсвэл хаагдсан хэрэглэгч — session-ийг хүчингүй болгоно
        if (!dbUser || !dbUser.isActive) return null;

        token.sub      = dbUser.id;
        token.role     = dbUser.role;
        token.name     = dbUser.nickname ?? token.name;
        token.picture  = dbUser.avatarUrl ?? token.picture;
        token.syncedAt = Date.now();
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        Object.assign(session.user, {
          id:    token.sub,
          role:  typeof token.role === "string" ? token.role : undefined,
          image: typeof token.picture === "string" ? token.picture : null,
        });
      }

      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});