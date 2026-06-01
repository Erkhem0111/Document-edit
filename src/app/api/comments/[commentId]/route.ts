import { jsonError, requireProjectRole, requireUser, withApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type Params = Promise<{ commentId: string }>;

export const PATCH = withApiError(async function PATCH(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { commentId } = await context.params;
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    include: { file: true },
  });
  if (!comment) return jsonError("Comment олдсонгүй.", 404);

  const canEdit = comment.userId === user.id || user.role === "ADMIN";
  if (!canEdit) return jsonError("Comment засах эрхгүй.", 403);

  const body = await req.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return jsonError("Comment хоосон байж болохгүй.", 400);

  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: { content, isEdited: true },
  });

  return NextResponse.json({ comment: updated });
});

export const DELETE = withApiError(async function DELETE(_req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { commentId } = await context.params;
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    include: { file: true },
  });
  if (!comment) return jsonError("Comment олдсонгүй.", 404);

  const membership = await requireProjectRole(comment.file.projectId, user, "OWNER");
  const canDelete = comment.userId === user.id || Boolean(membership);
  if (!canDelete) return jsonError("Comment устгах эрхгүй.", 403);

  await prisma.comment.delete({ where: { id: commentId } });

  return NextResponse.json({ message: "Comment устгагдлаа." });
});
