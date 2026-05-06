import { jsonError, requireProjectRole, requireUser, serializeJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type Params = Promise<{ fileId: string }>;

export async function GET(_req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { fileId } = await context.params;
  const file = await prisma.projectFile.findUnique({ where: { id: fileId } });
  if (!file) return jsonError("Файл олдсонгүй.", 404);

  const membership = await requireProjectRole(file.projectId, user, "VIEWER");
  if (!membership) return jsonError("Comment харах эрхгүй.", 403);

  const comments = await prisma.comment.findMany({
    where: { fileId, parentId: null },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, email: true, nickname: true, avatarUrl: true } },
      replies: {
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { id: true, email: true, nickname: true, avatarUrl: true } },
        },
      },
    },
  });

  return NextResponse.json({ comments: serializeJson(comments) });
}

export async function POST(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { fileId } = await context.params;
  const file = await prisma.projectFile.findUnique({ where: { id: fileId } });
  if (!file) return jsonError("Файл олдсонгүй.", 404);

  const membership = await requireProjectRole(file.projectId, user, "VIEWER");
  if (!membership) return jsonError("Comment бичих эрхгүй.", 403);

  const body = await req.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const parentId = typeof body.parentId === "string" ? body.parentId : null;
  if (!content) return jsonError("Comment хоосон байж болохгүй.", 400);

  const comment = await prisma.comment.create({
    data: {
      fileId,
      userId: user.id,
      parentId,
      content,
    },
    include: {
      user: { select: { id: true, email: true, nickname: true, avatarUrl: true } },
    },
  });

  return NextResponse.json({ comment: serializeJson(comment) }, { status: 201 });
}
