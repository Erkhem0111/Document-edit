import {
  jsonError,
  requireProjectRole,
  requireUser,
  withApiError,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { lockFolderTree } from "@/lib/folder-lock";
import { NextResponse } from "next/server";

type Params = Promise<{ folderId: string }>;

// PATCH /api/folders/[folderId]  { name?, parentId? } — нэр солих ба/эсвэл
// мөн төслийн өөр хавтас руу (parentId: null = үндсэн хэсэг) зөөх
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
  const name =
    typeof body.name === "string" ? body.name.trim().slice(0, 120) : undefined;
  const moving = "parentId" in body;
  const parentId: string | null =
    moving && typeof body.parentId === "string" && body.parentId ? body.parentId : null;
  if (name !== undefined && !name) return jsonError("Folder-ийн нэр шаардлагатай.", 400);
  if (name === undefined && !moving) return jsonError("Өөрчлөх зүйл алга.", 400);

  // Шалгалт ба зөөлтийг төслийн хавтасны lock дор хийнэ: А-г Б руу, Б-г А руу
  // зэрэг зөөвөл хоёр хүсэлт хоёулаа "давталтгүй" гэж үзээд мод эвдрэх байсан.
  const result = await prisma.$transaction(async (tx) => {
    if (moving && parentId) {
      await lockFolderTree(tx, folder.projectId);
      // Очих хавтас мөн төсөлд байх ёстой, өөрөө эсвэл өөрийн дэд хавтас биш
      const all = await tx.folder.findMany({
        where: { projectId: folder.projectId },
        select: { id: true, parentId: true },
      });
      const byId = new Map(all.map((f) => [f.id, f.parentId]));
      if (!byId.has(parentId)) return { error: "Очих хавтас олдсонгүй.", status: 400 };
      for (let cur: string | null = parentId; cur; cur = byId.get(cur) ?? null) {
        if (cur === folderId) {
          return { error: "Хавтсыг өөрийнх нь дотор зөөх боломжгүй.", status: 400 };
        }
      }
    }
    const updated = await tx.folder.update({
      where: { id: folderId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(moving ? { parentId } : {}),
      },
      select: { id: true, name: true, parentId: true },
    });
    return { folder: updated };
  });
  if ("error" in result) return jsonError(result.error!, result.status);

  return NextResponse.json({ folder: result.folder });
});

// DELETE /api/folders/[folderId] — folder устгана.
// Дэд folder-ууд устана; доторх (дэд folder-уудынх ч) файлууд устгасан folder-ийн
// эх folder руу шилжинэ — хэрэглэгчид харуулдаг анхааруулгатай ижил.
export const DELETE = withApiError(async function DELETE(_req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { folderId } = await context.params;
  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
    select: { projectId: true, parentId: true },
  });
  if (!folder) return jsonError("Folder олдсонгүй.", 404);

  const membership = await requireProjectRole(folder.projectId, user, "EDITOR");
  if (!membership) return jsonError("Устгах эрхгүй.", 403);

  // Устгах үед ч модыг түгжинэ — зэрэг явж буй зөөлтийн дараах бодит модоор
  // дэд хавтаснуудыг тооцно (эс бөгөөс зөөгдөж орсон хавтасны файл алга болно).
  await prisma.$transaction(async (tx) => {
    await lockFolderTree(tx, folder.projectId);
    const current = await tx.folder.findUnique({
      where: { id: folderId },
      select: { parentId: true },
    });
    if (!current) return; // зэрэг ирсэн өөр устгалт түрүүлсэн
    // Устах folder болон бүх дэд folder-уудын id
    const all = await tx.folder.findMany({
      where: { projectId: folder.projectId },
      select: { id: true, parentId: true },
    });
    const removed = new Set([folderId]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const f of all) {
        if (f.parentId && removed.has(f.parentId) && !removed.has(f.id)) {
          removed.add(f.id);
          grew = true;
        }
      }
    }
    await tx.projectFile.updateMany({
      where: { folderId: { in: [...removed] } },
      data: { folderId: current.parentId },
    });
    await tx.folder.delete({ where: { id: folderId } });
  });

  return NextResponse.json({ message: "Folder устгагдлаа." });
});
