import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;        // optional биш — заавал байх ёстой
      role?: string;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;          // нэмэв
    role?: string;
  }
}