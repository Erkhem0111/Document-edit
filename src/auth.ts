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
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.passwordHash) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) return null;

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
      if (account?.provider !== "google" || !user.email) {
        return true;
      }

      const existingUser = await prisma.user.findUnique({
        where: { email: user.email },
      });

      if (!existingUser) {
        await prisma.user.create({
          data: {
            email: user.email,
            nickname: null,
            avatarUrl: user.image ?? null,
            passwordHash: "",
            role: "ENGINEER",
          },
        });
      } else if (existingUser.avatarUrl !== (user.image ?? null)) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { avatarUrl: user.image ?? null },
        });
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user && "role" in user) {
        token.role = user.role;
      }

      if (token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
        });

        if (dbUser) {
          token.sub = dbUser.id;
          token.role = dbUser.role;
          token.name = dbUser.nickname ?? token.name;
          token.picture = dbUser.avatarUrl ?? token.picture;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        Object.assign(session.user, {
          id: token.sub,
          role: typeof token.role === "string" ? token.role : undefined,
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
