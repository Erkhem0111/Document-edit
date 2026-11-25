import { jsonError, requireUser, serializeJson, withApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

const VISIBILITIES = ["PUBLIC", "SHARED", "PRIVATE", "REFERENCE"] as const;

export const GET = withApiError(async function GET(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  // Харагдах төслүүд:
  //  • Өөрийн (member) төсөл — ямар ч төлөвт (Archive/Trash folder-т бүлэглэхэд хэрэгтэй)
  //  • Бусдын идэвхтэй PUBLIC/REFERENCE төсөл — бүгд харах ёстой
  const where: Prisma.ProjectWhereInput =
    user.role === "ADMIN"
      ? {
          OR: [
            { visibility: { not: "PRIVATE" } },
            {
              visibility: "PRIVATE",
              members: { some: { userId: user.id, role: "OWNER" } },
            },
          ],
        }
      : {
          OR: [
            {
              visibility: "PRIVATE",
              members: { some: { userId: user.id, role: "OWNER" } },
            },
            // Гишүүн төсөл — хогийн саванд орсон бол зөвхөн эзэнд нь харагдана
            // (засварлагч/үзэгч сэргээж, устгаж чадахгүй тул харуулахгүй)
            {
              visibility: { not: "PRIVATE" },
              trashedAt: null,
              members: { some: { userId: user.id } },
            },
            {
              visibility: { not: "PRIVATE" },
              members: { some: { userId: user.id, role: "OWNER" } },
            },
            // Компанийн нийтийн төсөл — админ зөвшөөрсөн хэрэглэгчид л
            ...(user.isApproved === false
              ? []
              : [{ visibility: { in: ["PUBLIC", "REFERENCE"] }, trashedAt: null } as Prisma.ProjectWhereInput]),
          ],
        };

  // ?sizes=1 → зөвхөн төсөл бүрийн нийт хэмжээ. Хэмжээг нийлбэрлэх SQL хүнд
  // (файл бүрийн сүүлийн хувилбар) тул үүнийг хэрэгтэй хуудас (хавтасны жагсаалт)
  // л тусад нь дуудна — sidebar, бусад хуудас бүрт ажиллуулахгүй.
  if (new URL(req.url).searchParams.get("sizes") === "1") {
    const visible = await prisma.project.findMany({ where, select: { id: true } });
    const sizes: Record<string, string> = {};
    if (visible.length > 0) {
      const rows = await prisma.$queryRaw<{ projectId: string; size: bigint }[]>`
        SELECT f."projectId", COALESCE(SUM(v."fileSize"), 0)::bigint AS size
        FROM "ProjectFile" f
        JOIN LATERAL (
          SELECT "fileSize" FROM "FileVersion"
          WHERE "fileId" = f.id
          ORDER BY "versionNumber" DESC
          LIMIT 1
        ) v ON true
        WHERE f."projectId" IN (${Prisma.join(visible.map((p) => p.id))})
        GROUP BY f."projectId"
      `;
      for (const row of rows) sizes[row.projectId] = row.size.toString();
    }
    return NextResponse.json({ sizes });
  }

  const projects = await prisma.project.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    // include биш select — inviteCode зэрэг дотоод талбарыг клиент рүү явуулахгүй.
    // Файл, хавтасны жагсаалтыг энд БУЦААХГҮЙ — тэдгээрийг төслийг нээх үед
    // /api/projects/[id] болон /api/projects/[id]/files-аас ачаална. Энэ жагсаалт
    // хуудас бүрт (sidebar) дуудагддаг тул хөнгөн байх ёстой.
    select: {
      id: true,
      name: true,
      description: true,
      visibility: true,
      isArchived: true,
      trashedAt: true,
      createdAt: true,
      updatedAt: true,
      jobStage: true,
      jobType: true,
      jobClient: true,
      jobDueDate: true,
      jobDeliveredAt: true,
      _count: {
        select: {
          files: true,
          folders: true,
          tasks: true,
          members: true,
        },
      },
      members: {
        where: { userId: user.id },
        select: { role: true },
      },
    },
  });

  return NextResponse.json({ projects: serializeJson(projects) });
});

export const POST = withApiError(async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : null;
  const visibility = VISIBILITIES.includes(body.visibility)
    ? body.visibility
    : "PRIVATE";

  if (!name) return jsonError("Төслийн нэр шаардлагатай.", 400);
  // Компанийн сан (REFERENCE) — зөвхөн админ үүсгэнэ
  if (visibility === "REFERENCE" && user.role !== "ADMIN") {
    return jsonError("Компанийн санг зөвхөн админ үүсгэнэ.", 403);
  }


  const project = await prisma.project.create({
    data: {
      name,
      description,
      visibility,
      members: {
        create: {
          userId: user.id,
          role: "OWNER",
        },
      },
    },
    include: {
      _count: {
        select: {
          files: true,
          tasks: true,
          members: true,
        },
      },
      members: {
        where: { userId: user.id },
        select: { role: true },
      },
    },
  });

  return NextResponse.json({ project: serializeJson(project) }, { status: 201 });
});
