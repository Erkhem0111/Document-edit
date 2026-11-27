import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migration (prisma migrate) — шууд (unpooled) холболт хэрэгтэй: Neon-ий pooler
// (PgBouncer) migration-ий advisory lock, урт transaction-ийг дэмждэггүй.
// Ажиллах үеийн апп (src/lib/prisma.ts) DATABASE_URL-ийг (pooled байж болно) ашиглана.
//   DIRECT_URL / DATABASE_URL_UNPOOLED (Vercel-ийн Neon integration) байвал түүнийг,
//   эс бөгөөс DATABASE_URL-ийг — өмнөх тохиргоо хэвээр ажиллана.
const migrationUrl =
  process.env.DIRECT_URL || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrationUrl,
  },
});
