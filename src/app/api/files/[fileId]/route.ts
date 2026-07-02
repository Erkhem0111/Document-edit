import {
  withApiError,
  isEditableInBrowser,
  isExternalEngineeringFile,
  jsonError,
  requireProjectRole,
  requireUser,
  serializeJson,
} from "@/lib/api";
import {
  canCreateEditableContent,
  getEditableUploadContent,
} from "@/lib/editable-upload";
import { prisma } from "@/lib/prisma";
import { buildObjectKey, downloadFromR2 } from "@/lib/r2";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

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
      project: { select: { visibility: true } },
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

  let content: unknown = file.content;
  if (
    !content &&
    file.versions.length > 0 &&
    canCreateEditableContent(file.name, file.mimeType)
  ) {
    const latestVersion = file.versions[0]?.versionNumber;
    if (latestVersion) {
      const objectKey = buildObjectKey(file.projectId, file.id, latestVersion);
      const buffer = await downloadFromR2(objectKey);
      const editableContent = await getEditableUploadContent({
        buffer,
        fileName: file.name,
        mimeType: file.mimeType,
      });
      if (editableContent) {
        content = editableContent;
        await prisma.projectFile.update({
          where: { id: file.id },
          data: { content: editableContent as Prisma.InputJsonValue },
        });
      }
    }
  }

  return NextResponse.json({
    file: serializeJson({
      ...file,
      content,
      openMode:
        content && canCreateEditableContent(file.name, file.mimeType)
          ? "browser"
          : getOpenMode(file.mimeType, file.name),
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
  if (existing.project.visibility === "REFERENCE") {
    return jsonError("Reference folder read-only тул файл засах боломжгүй.", 403);
  }
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
  if (existing.project.visibility === "REFERENCE") {
    return jsonError("Reference folder read-only тул файл устгах боломжгүй.", 403);
  }

  await prisma.projectFile.delete({ where: { id: fileId } });

  return NextResponse.json({ message: "File deleted." });
});
