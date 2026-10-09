import { getVisibleProjectWhere, requireUser, serializeJson, withApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/search?q=...
// Файлыг нэрээр нь хайна. Хэрэглэгчийн хандах эрхтэй (member, эсвэл
// PUBLIC/REFERENCE) болон Trash-д ороогүй project доторх файлуудыг буцаана.
export const GET = withApiError(async function GET(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json({ results: [] });

  const files = await prisma.projectFile.findMany({
    where: {
      name: { contains: q, mode: "insensitive" },
      project: getVisibleProjectWhere(user),
    },
    orderBy: { updatedAt: "desc" },
    take: 15,
    select: {
      id: true,
      name: true,
      mimeType: true,
      projectId: true,
      project: { select: { name: true } },
    },
  });

  return NextResponse.json({ results: serializeJson(files) });
});
