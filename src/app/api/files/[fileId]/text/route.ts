import { jsonError, requireProjectRole, requireUser, withApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { downloadFromR2 } from "@/lib/r2";
import { isCoordinateFileName } from "@/lib/coordinates";
import { NextResponse } from "next/server";

type Params = Promise<{ fileId: string }>;

const MAX_TEXT_BYTES = 5 * 1024 * 1024;

// GET /api/files/[fileId]/text — координатын жижиг текст файлыг (CSV/TXT…)
// сервер дээрээс уншиж буцаана (browser R2 руу шууд хандахгүй, CORS хэрэггүй).
export const GET = withApiError(async function GET(_req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { fileId } = await context.params;
  const file = await prisma.projectFile.findUnique({
    where: { id: fileId },
    select: {
      name: true,
      projectId: true,
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: { objectKey: true, fileSize: true },
      },
    },
  });
  if (!file) return jsonError("Файл олдсонгүй.", 404);

  const membership = await requireProjectRole(file.projectId, user, "VIEWER");
  if (!membership) return jsonError("Энэ файлыг харах эрхгүй.", 403);

  if (!isCoordinateFileName(file.name)) {
    return jsonError("Зөвхөн CSV/TXT координатын файлыг уншина.", 400);
  }
  const latest = file.versions[0];
  if (!latest) return jsonError("Файлын агуулга алга.", 404);
  if (Number(latest.fileSize) > MAX_TEXT_BYTES) {
    return jsonError("Файл хэт том байна (5MB хүртэл).", 413);
  }

  const buffer = await downloadFromR2(latest.objectKey);
  // Монгол программуудын хуучин файл ихэвчлэн Windows-1251 кодлолтой байдаг
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    text = new TextDecoder("windows-1251").decode(buffer);
  }

  return NextResponse.json({ name: file.name, text });
});
