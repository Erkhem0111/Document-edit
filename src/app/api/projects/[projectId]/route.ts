import {
  withApiError,
  jsonError,
  requireProjectRole,
  requireUser,
  serializeJson,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { buildObjectKey, deleteFromR2 } from "@/lib/r2";
import { NextResponse } from "next/server";

type Params = Promise<{ projectId: string }>;

const VISIBILITIES = ["PUBLIC", "SHARED", "PRIVATE", "REFERENCE"] as const;

export const GET = withApiError(async function GET(_req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { projectId } = await context.params;
  const membership = await requireProjectRole(projectId, user, "VIEWER");
  if (!membership) return jsonError("Энэ төсөлд хандах эрхгүй.", 403);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              nickname: true,
              avatarUrl: true,
            },
          },
        },
      },
      files: {
        // Файл нь project-ийн хандалтыг өвлөнө — project-ийг харж чадвал бүх файлыг харна
        include: {
          uploader: {
            select: {
              id: true,
              email: true,
              nickname: true,
              avatarUrl: true,
            },
          },
          lockedBy: {
            select: {
              id: true,
              email: true,
              nickname: true,
              avatarUrl: true,
            },
          },
          versions: {
            orderBy: { versionNumber: "desc" },
            take: 1,
            select: {
              id: true,
              versionNumber: true,
              fileSize: true,
              checksum: true,
              commitMsg: true,
              createdAt: true,
            },
          },
          _count: {
            select: { comments: true, versions: true },
          },
        },
        orderBy: { updatedAt: "desc" },
      },
      folders: {
        select: { id: true, name: true, parentId: true, createdAt: true },
        orderBy: { name: "asc" },
      },
      tasks: {
        include: {
          assignee: { select: { id: true, email: true, nickname: true } },
          creator: { select: { id: true, email: true, nickname: true } },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  if (!project) return jsonError("Төсөл олдсонгүй.", 404);

  return NextResponse.json({ project: serializeJson(project) });
});

export const PATCH = withApiError(async function PATCH(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { projectId } = await context.params;
  const membership = await requireProjectRole(projectId, user, "OWNER");
  if (!membership) return jsonError("Төсөл засах эрхгүй.", 403);

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  const description =
    typeof body.description === "string" ? body.description.trim() : undefined;
  const isArchived =
    typeof body.isArchived === "boolean" ? body.isArchived : undefined;
  const visibility = VISIBILITIES.includes(body.visibility)
    ? (body.visibility as (typeof VISIBILITIES)[number])
    : undefined;
  // trashed: true → Trash руу зөөнө, false → сэргээнэ
  const trashedAt =
    typeof body.trashed === "boolean"
      ? body.trashed
        ? new Date()
        : null
      : undefined;

  if (name !== undefined && !name) {
    return jsonError("Төслийн нэр хоосон байж болохгүй.", 400);
  }

  const project = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(isArchived !== undefined ? { isArchived } : {}),
      ...(visibility !== undefined ? { visibility } : {}),
      ...(trashedAt !== undefined ? { trashedAt } : {}),
    },
  });

  return NextResponse.json({ project });
});

export const DELETE = withApiError(async function DELETE(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { projectId } = await context.params;
  const membership = await requireProjectRole(projectId, user, "OWNER");
  if (!membership) return jsonError("Төсөл устгах эрхгүй.", 403);

  // ?permanent=true → бүр мөсөн устгана (зөвхөн Trash-д байгаа төслийг)
  const permanent =
    new URL(req.url).searchParams.get("permanent") === "true";

  if (permanent) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { trashedAt: true },
    });
    if (!project) return jsonError("Төсөл олдсонгүй.", 404);
    if (!project.trashedAt) {
      return jsonError("Зөвхөн Trash доторх төслийг бүр мөсөн устгана.", 400);
    }
    // R2 цэвэрлэхийн тулд файл + version-уудыг устгахаас ӨМНӨ цуглуулна
    const files = await prisma.projectFile.findMany({
      where: { projectId },
      select: { id: true, versions: { select: { versionNumber: true } } },
    });

    await prisma.project.delete({ where: { id: projectId } });

    // R2 дээрх бодит файлуудыг цэвэрлэнэ (best-effort — R2 алдаа устгалтыг зогсоохгүй)
    await Promise.allSettled(
      files.flatMap((f) =>
        f.versions.map((v) =>
          deleteFromR2(buildObjectKey(projectId, f.id, v.versionNumber)),
        ),
      ),
    );

    return NextResponse.json({ message: "Төсөл бүр мөсөн устгагдлаа." });
  }

  // Шууд устгахгүй — эхлээд Trash руу зөөнө (сэргээх боломжтой)
  await prisma.project.update({
    where: { id: projectId },
    data: { trashedAt: new Date() },
  });

  return NextResponse.json({ message: "Төсөл Trash руу зөөгдлөө." });
});
