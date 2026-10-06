import {
  jsonError,
  requireProjectRole,
  requireUser,
  withApiError,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  copyInR2,
  deleteFromR2,
  getPublicUrl,
} from "@/lib/r2";
import { NextResponse } from "next/server";

type Params = Promise<{ fileId: string }>;

// POST /api/files/[fileId]/move  { projectId?, folderId? }
// Файлыг өөр project эсвэл дэд folder руу зөөнө.
// Өөр project руу зөөхөд R2 дээрх бодит объектуудыг хамт шилжүүлнэ.
export const POST = withApiError(async function POST(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { fileId } = await context.params;
  const file = await prisma.projectFile.findUnique({
    where: { id: fileId },
    select: {
      id: true,
      projectId: true,
      versions: { select: { versionNumber: true, objectKey: true } },
    },
  });
  if (!file) return jsonError("Файл олдсонгүй.", 404);

  // Файлыг project-оос нь гаргах = устгахтай адил хүнд үйлдэл тул эзэн байх ёстой
  const sourceMembership = await requireProjectRole(file.projectId, user, "OWNER");
  if (!sourceMembership) {
    return jsonError("Файл зөөх эрхгүй — эх төслийн эзэн байх ёстой.", 403);
  }

  const body = await req.json().catch(() => ({}));
  const targetProjectId =
    typeof body.projectId === "string" && body.projectId
      ? body.projectId
      : file.projectId;
  const rawFolderId =
    typeof body.folderId === "string" && body.folderId ? body.folderId : null;

  const target = await prisma.project.findUnique({
    where: { id: targetProjectId },
    select: { trashedAt: true },
  });
  if (!target) return jsonError("Очих төсөл олдсонгүй.", 404);
  if (target.trashedAt) {
    return jsonError("Trash доторх төсөл рүү зөөх боломжгүй.", 400);
  }

  // Очих төсөлд файл нэмэх (upload-тай адил) эрх шаардана
  if (targetProjectId !== file.projectId) {
    const targetMembership = await requireProjectRole(targetProjectId, user, "EDITOR");
    if (!targetMembership) {
      return jsonError("Очих төсөлд файл нэмэх эрхгүй.", 403);
    }
  }

  // folder нь очих project-д харьяалагдах ёстой
  let folderId: string | null = null;
  if (rawFolderId) {
    const folder = await prisma.folder.findUnique({
      where: { id: rawFolderId },
      select: { projectId: true },
    });
    if (!folder || folder.projectId !== targetProjectId) {
      return jsonError("Очих folder олдсонгүй.", 400);
    }
    folderId = rawFolderId;
  }

  if (targetProjectId === file.projectId) {
    // Нэг project дотор — зөвхөн folder солино
    await prisma.projectFile.update({
      where: { id: file.id },
      data: { folderId },
    });
    return NextResponse.json({ message: "Файл зөөгдлөө." });
  }

  // Өөр project руу: R2 объектуудыг зэрэг хуулна —
  // бие даасан хувилбарууд нэгэн зэрэг копийнд ордог тул latency буурна.
  // Хуучин key-ийн сүүлийн хэсгийг (v2-<uuid> г.м.) хадгалж зөвхөн projectId-г солино.
  const moves = file.versions.map((version) => ({
    versionNumber: version.versionNumber,
    from: version.objectKey,
    to: version.objectKey.replace(
      `projects/${file.projectId}/`,
      `projects/${targetProjectId}/`,
    ),
  }));

  await Promise.all(moves.map((m) => copyInR2(m.from, m.to)));

  await prisma.$transaction([
    prisma.projectFile.update({
      where: { id: file.id },
      data: { projectId: targetProjectId, folderId },
    }),
    ...moves.map((m) =>
      prisma.fileVersion.update({
        where: {
          fileId_versionNumber: {
            fileId: file.id,
            versionNumber: m.versionNumber,
          },
        },
        data: { objectKey: m.to, fileUrl: getPublicUrl(m.to) },
      }),
    ),
  ]);

  // Хуучин объектуудыг цэвэрлэнэ (best-effort — алдаа зөөлтийг зогсоохгүй)
  await Promise.allSettled(moves.map((m) => deleteFromR2(m.from)));

  return NextResponse.json({ message: "Файл зөөгдлөө." });
});
