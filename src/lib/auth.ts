import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

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

      if (existingUser && !existingUser.isActive) return false;

      if (!existingUser) {
        await prisma.user.create({
          data: {
            email,
            nickname: null,
            avatarUrl: user.image ?? null,
            passwordHash: "",
            role: "ENGINEER",
            lastLoginAt: new Date(),
          },
        });
      } else {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            avatarUrl: user.image ?? null,
            lastLoginAt: new Date(),
          },
        });
      }

      return true;
    },

    // ── JWT callback ──────────────────────────────────────────────────────────
    // Өмнө: token.email байвал БҮРТ DB query хийдэг байсан
    //       → session шалгах бүрт (хуудас ачаалах, API дуудах г.м.) DB hit
    // Одоо: зөвхөн шинэ login (user байх) эсвэл session.update() дуудагдвал
    //       DB query хийнэ → бусад үед token-д хадгалагдсан утгыг ашиглана
    async jwt({ token, user, trigger }) {
      if (user || trigger === "update") {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email! },
          select: {
            id: true,
            role: true,
            nickname: true,
            avatarUrl: true,
          },
        });

        if (dbUser) {
          token.sub     = dbUser.id;
          token.role    = dbUser.role;
          token.name    = dbUser.nickname ?? token.name;
          token.picture = dbUser.avatarUrl ?? token.picture;
        }
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