import {
  withApiError,
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

function getFileAccessContext(fileId: string) {
  return prisma.projectFile.findUnique({
    where: { id: fileId },
    select: {
      id: true,
      projectId: true,
      isLocked: true,
      lockedById: true,
    },
  });
}

export const GET = withApiError(async function GET(_req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { fileId } = await context.params;
  const accessFile = await getFileAccessContext(fileId);
  if (!accessFile) return jsonError("File not found.", 404);

  const membership = await requireProjectRole(accessFile.projectId, user, "VIEWER");
  if (!membership) return jsonError("No permission to view this file.", 403);

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

  if (!file) return jsonError("File not found.", 404);

  return NextResponse.json({
    file: serializeJson({
      ...file,
      openMode: getOpenMode(file.mimeType, file.name),
    }),
  });
});

export const PATCH = withApiError(async function PATCH(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { fileId } = await context.params;
  const existing = await getFileAccessContext(fileId);
  if (!existing) return jsonError("File not found.", 404);

  const membership = await requireProjectRole(existing.projectId, user, "EDITOR");
  if (!membership) return jsonError("No permission to edit this file.", 403);
  if (existing.isLocked && existing.lockedById !== user.id && user.role !== "ADMIN") {
    return jsonError("File is locked by another user.", 423);
  }

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  if (name !== undefined && !name) return jsonError("File name cannot be empty.", 400);

  const file = await prisma.projectFile.update({
    where: { id: fileId },
    data: {
      ...(name !== undefined ? { name } : {}),
    },
  });

  return NextResponse.json({ file });
});

export const DELETE = withApiError(async function DELETE(_req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { fileId } = await context.params;
  const existing = await getFileAccessContext(fileId);
  if (!existing) return jsonError("File not found.", 404);

  const membership = await requireProjectRole(existing.projectId, user, "OWNER");
  if (!membership) return jsonError("No permission to delete this file.", 403);

  await prisma.projectFile.delete({ where: { id: fileId } });

  return NextResponse.json({ message: "File deleted." });
});
