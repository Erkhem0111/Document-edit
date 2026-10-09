import { getVisibleProjectWhere, requireUser, serializeJson, withApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/files/recent — нүүр хуудасны "Сүүлд өөрчлөгдсөн" жагсаалт.
// Хэрэглэгчийн харж болох идэвхтэй төслүүдийн хамгийн сүүлд засагдсан файлууд.
export const GET = withApiError(async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const files = await prisma.projectFile.findMany({
    where: { project: getVisibleProjectWhere(user) },
    orderBy: { updatedAt: "desc" },
    take: 12,
    select: {
      id: true,
      name: true,
      mimeType: true,
      projectId: true,
      updatedAt: true,
      project: { select: { name: true, visibility: true } },
      uploader: { select: { id: true, email: true, nickname: true } },
    },
  });

  return NextResponse.json({ files: serializeJson(files) });
});
