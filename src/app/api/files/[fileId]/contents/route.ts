import { jsonError, requireProjectRole, requireUser, withApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

type Params = Promise<{ fileId: string }>;

// ~5MB текст — энгийн баримтад хангалттай их
const MAX_CONTENT_CHARS = 5 * 1024 * 1024;

export const PATCH = withApiError(async function PATCH(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { fileId } = await context.params;
  const file = await prisma.projectFile.findUnique({
    where: { id: fileId },
    include: { project: { select: { visibility: true } } },
  });
  if (!file) return jsonError("Файл олдсонгүй.", 404);

  const membership = await requireProjectRole(file.projectId, user, "EDITOR");
  if (!membership) return jsonError("Засах эрхгүй.", 403);
  // Reference folder read-only — агуулга засахыг хориглоно
  if (file.project.visibility === "REFERENCE") {
    return jsonError("Reference folder-ийн файлыг засах боломжгүй.", 403);
  }
  if (file.isLocked && file.lockedById !== user.id && user.role !== "ADMIN") {
    return jsonError("Файл lock-той байна.", 423);
  }

  // Хэт том JSON-оор DB-г дүүргэхээс сэргийлнэ
  const raw = await req.text();
  if (raw.length > MAX_CONTENT_CHARS) {
    return jsonError("Баримт хэтэрхий том байна.", 413);
  }
  const body = (() => {
    try {
      return JSON.parse(raw) as { content?: unknown };
    } catch {
      return null;
    }
  })();
  // Зөвхөн Tiptap баримт ({ type: "doc", content: [...] }) хүлээн авна
  const content = body?.content as { type?: unknown; content?: unknown } | undefined;
  if (
    !content ||
    typeof content !== "object" ||
    content.type !== "doc" ||
    (content.content !== undefined && !Array.isArray(content.content))
  ) {
    return jsonError("Content буруу бүтэцтэй байна.", 400);
  }

  const updated = await prisma.projectFile.update({
    where: { id: fileId },
    data: { content: content as Prisma.InputJsonValue },
  });

  return NextResponse.json({ ok: true, updatedAt: updated.updatedAt });
});