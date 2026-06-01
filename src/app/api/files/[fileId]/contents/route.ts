import { canEditFile, jsonError, requireProjectRole, requireUser, withApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type Params = Promise<{ fileId: string }>;

export const PATCH = withApiError(async function PATCH(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { fileId } = await context.params;
  const file = await prisma.projectFile.findUnique({ where: { id: fileId } });
  if (!file) return jsonError("Файл олдсонгүй.", 404);

  const membership = await requireProjectRole(file.projectId, user, "EDITOR");
  if (!membership) return jsonError("Засах эрхгүй.", 403);
  if (!canEditFile(file, user)) return jsonError("Засах эрхгүй.", 403);
  if (file.isLocked && file.lockedById !== user.id && user.role !== "ADMIN") {
    return jsonError("Файл lock-той байна.", 423);
  }

  const body = await req.json();
  if (!body.content || typeof body.content !== "object") {
    return jsonError("Content шаардлагатай.", 400);
  }

  const updated = await prisma.projectFile.update({
    where: { id: fileId },
    data: { content: body.content },
  });

  return NextResponse.json({ ok: true, updatedAt: updated.updatedAt });
});