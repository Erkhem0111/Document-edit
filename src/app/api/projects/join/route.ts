import { jsonError, requireUser, serializeJson, withApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// POST /api/projects/join  { code }
// Урих кодоор Shared folder-т EDITOR болж нэгдэнэ.
export const POST = withApiError(async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const body = await req.json().catch(() => ({}));
  const code =
    typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!code) return jsonError("Урих код шаардлагатай.", 400);

  const project = await prisma.project.findUnique({
    where: { inviteCode: code },
    select: { id: true, name: true, visibility: true, trashedAt: true },
  });

  if (!project || project.visibility !== "SHARED" || project.trashedAt) {
    return jsonError("Ийм код олдсонгүй эсвэл идэвхгүй.", 404);
  }

  // Аль хэдийн гишүүн бол дахин нэмэхгүй, эрхийг нь бууруулахгүй
  await prisma.projectMember.upsert({
    where: {
      projectId_userId: { projectId: project.id, userId: user.id },
    },
    create: { projectId: project.id, userId: user.id, role: "EDITOR" },
    update: {},
  });

  return NextResponse.json({
    project: serializeJson({ id: project.id, name: project.name }),
  });
});
