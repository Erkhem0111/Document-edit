import { jsonError, requireUser, serializeJson, withApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { generateInviteCode } from "@/lib/invite-code";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

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
      // Зүүн талын folder мод болон folder-ийн нийт багтаамжид хэрэгтэй
      // (хөнгөн талбарууд, content-гүй; хамгийн сүүлийн version-ийн хэмжээ)
      files: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          mimeType: true,
          folderId: true,
          createdAt: true,
          versions: {
            orderBy: { versionNumber: "desc" },
            take: 1,
            select: { fileSize: true },
          },
        },
      },
      folders: {
        select: { id: true, name: true, parentId: true, createdAt: true },
        orderBy: { name: "asc" },
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
