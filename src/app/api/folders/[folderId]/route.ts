import {
  jsonError,
  requireProjectRole,
  requireUser,
  withApiError,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type Params = Promise<{ folderId: string }>;

// PATCH /api/folders/[folderId]  { name } — folder нэр солих
export const PATCH = withApiError(async function PATCH(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { folderId } = await context.params;
  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
    select: { projectId: true },
  });
  if (!folder) return jsonError("Folder олдсонгүй.", 404);

  // Reference-д requireProjectRole нь эзнээс бусдад VIEWER өгдөг тул
  // энд EDITOR шаардвал зөвхөн эзэн folder-оо удирдана (үүсгэхтэй нийцнэ)
  const membership = await requireProjectRole(folder.projectId, user, "EDITOR");
  if (!membership) return jsonError("Засах эрхгүй.", 403);

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!name) return jsonError("Folder-ийн нэр шаардлагатай.", 400);

  const updated = await prisma.folder.update({
    where: { id: folderId },
    data: { name },
    select: { id: true, name: true, parentId: true },
  });

  return NextResponse.json({ folder: updated });
});

// DELETE /api/folders/[folderId] — folder устгана.
// Дэд folder-ууд cascade устана; доторх файлууд project root руу шилжинэ (SetNull).
export const DELETE = withApiError(async function DELETE(_req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { folderId } = await context.params;
  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
    select: { projectId: true },
  });
  if (!folder) return jsonError("Folder олдсонгүй.", 404);

  const membership = await requireProjectRole(folder.projectId, user, "EDITOR");
  if (!membership) return jsonError("Устгах эрхгүй.", 403);

  await prisma.folder.delete({ where: { id: folderId } });

  return NextResponse.json({ message: "Folder устгагдлаа." });
});
