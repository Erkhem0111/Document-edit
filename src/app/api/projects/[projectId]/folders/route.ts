import {
  jsonError,
  requireProjectRole,
  requireUser,
  serializeJson,
  withApiError,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type Params = Promise<{ projectId: string }>;

// POST /api/projects/[projectId]/folders  { name, parentId? }
// Дэд folder үүсгэнэ (parentId = null бол project root дээр).
export const POST = withApiError(async function POST(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { projectId } = await context.params;
  const membership = await requireProjectRole(projectId, user, "EDITOR");
  if (!membership) return jsonError("Folder үүсгэх эрхгүй.", 403);
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  const parentId = typeof body.parentId === "string" && body.parentId ? body.parentId : null;

  if (!name) return jsonError("Folder-ийн нэр шаардлагатай.", 400);

  // parentId өгвөл тухайн project-д харьяалагдаж байгаа эсэхийг шалгана
  if (parentId) {
    const parent = await prisma.folder.findUnique({
      where: { id: parentId },
      select: { projectId: true },
    });
    if (!parent || parent.projectId !== projectId) {
      return jsonError("Эцэг folder олдсонгүй.", 400);
    }
  }

  const folder = await prisma.folder.create({
    data: { projectId, parentId, name },
    select: { id: true, name: true, parentId: true, createdAt: true },
  });

  return NextResponse.json({ folder: serializeJson(folder) }, { status: 201 });
});
