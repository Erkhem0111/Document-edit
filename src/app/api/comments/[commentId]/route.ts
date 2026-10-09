import { jsonError, requireProjectRole, requireUser, withApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { MAX_COMMENT_LENGTH } from "@/lib/limits";

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

  const membership = await requireProjectRole(comment.file.projectId, user, "VIEWER");
  const canEdit =
    user.role === "ADMIN" || (comment.userId === user.id && Boolean(membership));
  if (!canEdit) return jsonError("Comment засах эрхгүй.", 403);

  const body = await req.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return jsonError("Comment хоосон байж болохгүй.", 400);
  if (content.length > MAX_COMMENT_LENGTH) {
    return jsonError("Comment хэтэрхий урт байна.", 400);
  }

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

  const [canView, canModerate] = await Promise.all([
    requireProjectRole(comment.file.projectId, user, "VIEWER"),
    requireProjectRole(comment.file.projectId, user, "OWNER"),
  ]);
  const canDelete =
    user.role === "ADMIN" ||
    Boolean(canModerate) ||
    (comment.userId === user.id && Boolean(canView));
  if (!canDelete) return jsonError("Comment устгах эрхгүй.", 403);

  // Thread-ийг бүхэлд нь устгана — DB нь хариуг SET NULL болгодог тул
  // хариунууд бие даасан comment болж үлдэхээс сэргийлнэ.
  await prisma.$transaction([
    prisma.comment.deleteMany({ where: { parentId: commentId } }),
    prisma.comment.delete({ where: { id: commentId } }),
  ]);

  return NextResponse.json({ message: "Comment устгагдлаа." });
});
