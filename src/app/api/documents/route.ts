import { jsonError, requireProjectRole, requireUser, withApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createBlankDocument, ensurePersonalWorkspace } from "@/lib/workspace";
import { NextResponse } from "next/server";

// POST /api/documents  { projectId?, folderId?, name? }
// Нэг товчоор шинэ баримт: төсөл өгөөгүй бол хэрэглэгчийн "Миний баримтууд"-д
// үүсгэнэ. Нэр өгөөгүй бол "Нэргүй баримт" — нэрийг editor дотроос солино.
export const POST = withApiError(async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const body = (await req.json().catch(() => ({}))) as {
    projectId?: unknown;
    folderId?: unknown;
    name?: unknown;
  };
  const rawName = typeof body.name === "string" ? body.name.trim() : "";
  const name = (rawName || "Нэргүй баримт").slice(0, 120);

  let projectId: string;
  if (typeof body.projectId === "string" && body.projectId) {
    projectId = body.projectId;
    const membership = await requireProjectRole(projectId, user, "EDITOR");
    if (!membership) return jsonError("Энэ төсөлд баримт үүсгэх эрхгүй.", 403);
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { visibility: true },
    });
    if (project?.visibility === "REFERENCE") {
      return jsonError("Reference төсөлд шинэ баримт үүсгэх боломжгүй — зөвхөн файл оруулна.", 403);
    }
  } else {
    projectId = await ensurePersonalWorkspace(user.id);
  }

  // folderId нь тухайн төсөлд харьяалагдах ёстой
  let folderId: string | null = null;
  if (typeof body.folderId === "string" && body.folderId) {
    const folder = await prisma.folder.findUnique({
      where: { id: body.folderId },
      select: { projectId: true },
    });
    if (folder?.projectId === projectId) folderId = body.folderId;
  }

  const file = await createBlankDocument({ req, user, projectId, folderId, name });
  return NextResponse.json({ file }, { status: 201 });
});
