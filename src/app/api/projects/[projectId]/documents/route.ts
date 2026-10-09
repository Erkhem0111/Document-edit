import {
  withApiError,
  jsonError,
  requireProjectRole,
  requireUser,
} from "@/lib/api";
import { createBlankDocument } from "@/lib/workspace";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type Params = Promise<{ projectId: string }>;

// POST /api/projects/[projectId]/documents
// Хоосон document (Google-Docs маягийн баримт) үүсгэнэ — R2 binary биш,
// агуулга нь Liveblocks/collaborative editor дотор амьдарна.
export const POST = withApiError(async function POST(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { projectId } = await context.params;
  const membership = await requireProjectRole(projectId, user, "EDITOR");
  if (!membership) return jsonError("Баримт үүсгэх эрхгүй.", 403);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { visibility: true },
  });
  if (!project) return jsonError("Төсөл олдсонгүй.", 404);
  // Reference = бэлэн материалын сан: шинэ баримт үүсгэхгүй, зөвхөн upload
  if (project.visibility === "REFERENCE") {
    return jsonError("Reference folder-т шинэ баримт үүсгэх боломжгүй — зөвхөн файл upload хийнэ.", 403);
  }

  const body = await req.json().catch(() => ({}));
  const rawName = typeof body.name === "string" ? body.name.trim() : "";
  const name = (rawName || "Нэргүй баримт").slice(0, 120);

  // folderId өгвөл тухайн project-д харьяалагдаж байгаа эсэхийг шалгана
  let folderId: string | null = null;
  if (typeof body.folderId === "string" && body.folderId) {
    const parent = await prisma.folder.findUnique({
      where: { id: body.folderId },
      select: { projectId: true },
    });
    if (parent?.projectId === projectId) folderId = body.folderId;
  }

  const file = await createBlankDocument({ req, user, projectId, folderId, name });

  return NextResponse.json({ file: { ...file, openMode: "browser" } }, { status: 201 });
});
