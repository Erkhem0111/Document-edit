import { getVisibleProjectWhere, requireUser, withApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Компанийн нийт хадгалалтын ашиглалт — бүх file version-ийн хэмжээний нийлбэр.
// Quota-г R2_QUOTA_BYTES env-ээс авна, эс бол 50 GB.
const DEFAULT_QUOTA_BYTES = 50 * 1024 * 1024 * 1024;

type CategoryRow = { category: string; size: bigint };

export const GET = withApiError(async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  // Folder (хандалтын төрөл) тус бүр хэр их зай эзэлж байгаа — Windows-ын
  // диск шиг задаргаа. Хогийн саванд байгаа нь тусдаа (устгавал чөлөөлөгдөнө).
  // Зөвхөн нийлбэр тоо тул файлын нэр, агуулга задрахгүй.
  const [aggregate, categories, largest] = await Promise.all([
    prisma.fileVersion.aggregate({ _sum: { fileSize: true } }),
    prisma.$queryRaw<CategoryRow[]>`
      SELECT
        CASE WHEN p."trashedAt" IS NOT NULL THEN 'TRASH' ELSE p."visibility"::text END AS category,
        COALESCE(SUM(v."fileSize"), 0)::bigint AS size
      FROM "FileVersion" v
      JOIN "ProjectFile" f ON f.id = v."fileId"
      JOIN "Project" p ON p.id = f."projectId"
      GROUP BY 1
    `,
    // Хамгийн их зай эзэлж буй файлууд — зөвхөн хэрэглэгчийн харж болох төслөөс
    prisma.fileVersion.findMany({
      where: { file: { project: getVisibleProjectWhere(user) } },
      orderBy: { fileSize: "desc" },
      take: 20,
      select: {
        fileSize: true,
        file: {
          select: {
            id: true,
            name: true,
            mimeType: true,
            projectId: true,
            project: { select: { name: true, visibility: true } },
          },
        },
      },
    }),
  ]);

  const usedBytes = aggregate._sum.fileSize ?? BigInt(0);
  const quotaBytes = process.env.R2_QUOTA_BYTES
    ? BigInt(process.env.R2_QUOTA_BYTES)
    : BigInt(DEFAULT_QUOTA_BYTES);

  // Нэг файлын олон хувилбараас хамгийн томыг нь л үлдээнэ
  const seen = new Set<string>();
  const topFiles = largest
    .filter((v) => (seen.has(v.file.id) ? false : (seen.add(v.file.id), true)))
    .slice(0, 5)
    .map((v) => ({
      id: v.file.id,
      name: v.file.name,
      mimeType: v.file.mimeType,
      projectId: v.file.projectId,
      projectName: v.file.project.name,
      visibility: v.file.project.visibility,
      size: v.fileSize.toString(),
    }));

  return NextResponse.json({
    usedBytes: usedBytes.toString(),
    quotaBytes: quotaBytes.toString(),
    byCategory: Object.fromEntries(categories.map((c) => [c.category, c.size.toString()])),
    topFiles,
  });
});
