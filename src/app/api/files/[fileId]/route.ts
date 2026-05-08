import {
  isEditableInBrowser,
  isExternalEngineeringFile,
  jsonError,
  requireProjectRole,
  requireUser,
  serializeJson,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type Params = Promise<{ fileId: string }>;

function getOpenMode(mimeType: string, name: string) {
  if (isExternalEngineeringFile(mimeType, name)) return "external";
  if (isEditableInBrowser(mimeType, name)) return "browser";
  return "download";
}

export async function GET(_req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { fileId } = await context.params;
  const file = await prisma.projectFile.findUnique({
    where: { id: fileId },
    include: {
      uploader: { select: { id: true, email: true, nickname: true } },
      lockedBy: { select: { id: true, email: true, nickname: true } },
      versions: {
        orderBy: { versionNumber: "desc" },
        select: {
          id: true,
          versionNumber: true,
          fileSize: true,
          checksum: true,
          commitMsg: true,
          createdAt: true,
          uploadedBy: { select: { id: true, email: true, nickname: true } },
        },
      },
      comments: {
        where: { parentId: null },
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, email: true, nickname: true } },
          replies: {
            orderBy: { createdAt: "asc" },
            include: {
              user: { select: { id: true, email: true, nickname: true } },
            },
          },
        },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          user: { select: { id: true, email: true, nickname: true } },
        },
      },
    },
  });

  if (!file) return jsonError("Файл олдсонгүй.", 404);

  const membership = await requireProjectRole(file.projectId, user, "VIEWER");
  if (!membership) return jsonError("Файл харах эрхгүй.", 403);

  return NextResponse.json({
    file: serializeJson({
      ...file,
      openMode: getOpenMode(file.mimeType, file.name),
    }),
  });
}

export async function PATCH(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { fileId } = await context.params;
  const existing = await prisma.projectFile.findUnique({ where: { id: fileId } });
  if (!existing) return jsonError("Файл олдсонгүй.", 404);

  const membership = await requireProjectRole(existing.projectId, user, "EDITOR");
  if (!membership) return jsonError("Файл засах эрхгүй.", 403);
  if (existing.isLocked && existing.lockedById !== user.id && user.role !== "ADMIN") {
    return jsonError("Файл өөр хэрэглэгч дээр lock-той байна.", 423);
  }

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  if (name !== undefined && !name) return jsonError("Файлын нэр хоосон байж болохгүй.", 400);

  const file = await prisma.projectFile.update({
    where: { id: fileId },
    data: {
      ...(name !== undefined ? { name } : {}),
    },
  });

  return NextResponse.json({ file });
}

export async function DELETE(_req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { fileId } = await context.params;
  const existing = await prisma.projectFile.findUnique({ where: { id: fileId } });
  if (!existing) return jsonError("Файл олдсонгүй.", 404);

  const membership = await requireProjectRole(existing.projectId, user, "OWNER");
  if (!membership) return jsonError("Файл устгах эрхгүй.", 403);

  await prisma.projectFile.delete({ where: { id: fileId } });

  return NextResponse.json({ message: "Файл устгагдлаа." });
}
