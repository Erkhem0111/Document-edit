import { jsonError, requireUser, serializeJson, withApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { generateInviteCode } from "@/lib/invite-code";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

const VISIBILITIES = ["PUBLIC", "SHARED", "PRIVATE", "REFERENCE"] as const;

export const GET = withApiError(async function GET() {
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
            {
              visibility: { not: "PRIVATE" },
              members: { some: { userId: user.id } },
            },
            {
              visibility: { in: ["PUBLIC", "REFERENCE"] },
              isArchived: false,
              trashedAt: null,
            },
          ],
        };

  const projects = await prisma.project.findMany({
    where,
    orderBy: { updatedAt: "desc" },
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
      // Файлын жагсаалтыг энд БУЦААХГҮЙ — төсөл бүрийн бүх файлыг
      // (хувилбартай нь) татах нь файл олшрох тусам sidebar-ийг удаашруулдаг.
      // Файлуудыг төслийг нээх үед /api/projects/[id]-аас ачаална.
      folders: {
        select: { id: true, name: true, parentId: true, createdAt: true },
        orderBy: { name: "asc" },
      },
    },
  });

  // Төсөл бүрийн нийт багтаамжийг (файл бүрийн хамгийн сүүлийн хувилбар)
  // DB дотор нэг query-гээр нийлбэрлэнэ — файлуудыг JS рүү татахгүй.
  const sizes = new Map<string, string>();
  if (projects.length > 0) {
    const rows = await prisma.$queryRaw<{ projectId: string; size: bigint }[]>`
      SELECT f."projectId", COALESCE(SUM(v."fileSize"), 0)::bigint AS size
      FROM "ProjectFile" f
      JOIN LATERAL (
        SELECT "fileSize" FROM "FileVersion"
        WHERE "fileId" = f.id
        ORDER BY "versionNumber" DESC
        LIMIT 1
      ) v ON true
      WHERE f."projectId" IN (${Prisma.join(projects.map((p) => p.id))})
      GROUP BY f."projectId"
    `;
    for (const row of rows) sizes.set(row.projectId, row.size.toString());
  }

  const shaped = projects.map((project) => ({
    ...project,
    totalSize: sizes.get(project.id) ?? "0",
  }));

  return NextResponse.json({ projects: serializeJson(shaped) });
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

  // Shared folder бол урих кодыг шууд үүсгэнэ
  const inviteCode = visibility === "SHARED" ? generateInviteCode() : null;

  const project = await prisma.project.create({
    data: {
      name,
      description,
      visibility,
      inviteCode,
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
