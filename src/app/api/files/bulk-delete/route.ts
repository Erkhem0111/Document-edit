import { jsonError, requireProjectRole, requireUser, withApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { deleteFromR2 } from "@/lib/r2";
import { NextResponse } from "next/server";

const MAX_IDS = 500;

// POST /api/files/bulk-delete { fileIds: string[] } — олон файлыг нэг дор бүр мөсөн устгана.
// Нэг файлын DELETE-тэй ижил дүрэм: тухайн төслийн эзэн (эсвэл админ) л устгана.
// Эрхгүй/олдоогүй файлыг алгасаад тоог нь буцаана — бусад нь устгагдана.
export const POST = withApiError(async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const body = (await req.json().catch(() => null)) as { fileIds?: unknown } | null;
  const ids = Array.isArray(body?.fileIds)
    ? [...new Set(body.fileIds.filter((id): id is string => typeof id === "string" && id.length > 0))]
    : [];
  if (ids.length === 0) return jsonError("Устгах файл сонгоогүй байна.", 400);
  if (ids.length > MAX_IDS) return jsonError(`Нэг удаад ${MAX_IDS}-аас ихгүй файл устгана.`, 400);

  const files = await prisma.projectFile.findMany({
    where: { id: { in: ids } },
    select: { id: true, projectId: true },
  });

  // Төсөл тус бүрээр эрхийг нэг л удаа шалгана
  const allowedProjects = new Set<string>();
  for (const projectId of new Set(files.map((f) => f.projectId))) {
    if (await requireProjectRole(projectId, user, "OWNER")) allowedProjects.add(projectId);
  }
  const deletable = files.filter((f) => allowedProjects.has(f.projectId)).map((f) => f.id);
  if (deletable.length === 0) return jsonError("Эдгээр файлыг устгах эрхгүй.", 403);

  const versions = await prisma.fileVersion.findMany({
    where: { fileId: { in: deletable } },
    select: { objectKey: true },
  });
  await prisma.projectFile.deleteMany({ where: { id: { in: deletable } } });

  // R2 цэвэрлэгээ best-effort — алдаа нь устгалтыг буцаахгүй
  await Promise.allSettled(versions.map((v) => deleteFromR2(v.objectKey)));

  return NextResponse.json({
    deleted: deletable.length,
    skipped: ids.length - deletable.length,
  });
});
