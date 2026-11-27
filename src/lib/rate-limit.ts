import { prisma } from "@/lib/prisma";

// ─── Нэгдсэн хязгаарлагч (DB) ────────────────────────────────────────────────
// Зөвхөн АМЖИЛТГҮЙ оролдлогыг тоолно — нэг IP-ийн ард (оффис) олон хүн зөв
// нэвтрэхэд хаагдахгүй. Vercel-ийн бүх instance нэг тоолуур хуваалцана.
//
// DB алдаа гарвал (жишээ нь migration хараахан ажиллаагүй) хязгаарлахгүй
// өнгөрөөнө — нэвтрэлт хэзээ ч үүнээс болж зогсохгүй (proxy.ts дахь санах ойн
// хязгаарлагч хэвээр ажиллана).

export async function isBlocked(keys: string[], max: number, windowMs: number): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<{ blocked: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM "RateLimit"
        WHERE "key" = ANY(${keys})
          AND "count" >= ${max}
          AND "windowStart" >= now() - make_interval(secs => ${windowMs / 1000})
      ) AS blocked`;
    return Boolean(rows[0]?.blocked);
  } catch (error) {
    console.warn("Rate limiter unavailable, allowing request:", error);
    return false;
  }
}

// Амжилтгүй оролдлогыг нэмнэ. Нэг атомик SQL (INSERT … ON CONFLICT) — зэрэг
// ирсэн хүсэлтүүд ч зөв тоологдоно. Цонх дууссан бол 1-ээс эхэлнэ.
export async function recordFailure(keys: string[], windowMs: number): Promise<void> {
  try {
    const seconds = windowMs / 1000;
    for (const key of keys) {
      await prisma.$executeRaw`
        INSERT INTO "RateLimit" ("key", "count", "windowStart")
        VALUES (${key}, 1, now())
        ON CONFLICT ("key") DO UPDATE SET
          "count" = CASE
            WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${seconds}) THEN 1
            ELSE "RateLimit"."count" + 1 END,
          "windowStart" = CASE
            WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${seconds}) THEN now()
            ELSE "RateLimit"."windowStart" END`;
    }
    // Хуучин мөрүүдийг хааяа цэвэрлэнэ (хүснэгт өсөхгүй)
    if (Math.random() < 0.05) {
      await prisma.$executeRaw`DELETE FROM "RateLimit" WHERE "windowStart" < now() - interval '1 day'`;
    }
  } catch (error) {
    console.warn("Rate limiter unavailable, failure not recorded:", error);
  }
}

// Амжилттай нэвтэрсний дараа тухайн хаягийн тоолуурыг цэвэрлэнэ
export async function clearKeys(keys: string[]): Promise<void> {
  try {
    await prisma.$executeRaw`DELETE FROM "RateLimit" WHERE "key" = ANY(${keys})`;
  } catch {
    // заавал биш
  }
}
