import { requireUser, serializeJson, withApiError } from "@/lib/api";
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
      project: {
        trashedAt: null,
        ...(user.role === "ADMIN"
          ? {
              OR: [
                { visibility: { not: "PRIVATE" } },
                {
                  visibility: "PRIVATE",
                  members: { some: { userId: user.id, role: "OWNER" } },
                },
              ],
            }
          : {
              OR: [
                {
                  visibility: "PRIVATE",
                  members: { some: { userId: user.id, role: "OWNER" } },
                },
                {
                  visibility: { not: "PRIVATE" },
                  members: { some: { userId: user.id } },
                },
                { visibility: { in: ["PUBLIC", "REFERENCE"] } },
              ],
            }),
      },
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
