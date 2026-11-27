import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const prismaClientSingleton = () => {
  const connectionString =
    process.env.DATABASE_URL ??
    "postgresql://user:password@localhost:5432/document_edit";

  // Serverless (Vercel) дээр instance бүр өөрийн pool-той — олон instance зэрэг
  // ажиллахад Neon-ий холболтын хязгаар дүүрэхээс сэргийлж бага байлгана.
  // Холбогдож чадахгүй бол 10 секундэд алдаа өгнө (хязгааргүй хүлээхгүй).
  const max = Number(process.env.DATABASE_POOL_MAX) || (process.env.VERCEL ? 5 : 10);
  const adapter = new PrismaPg({
    connectionString,
    max,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error"] : ["error"],
  });
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;
