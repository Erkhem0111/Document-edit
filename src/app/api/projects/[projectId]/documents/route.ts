import {
  withApiError,
  getClientInfo,
  jsonError,
  requireProjectRole,
  requireUser,
  serializeJson,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type Params = Promise<{ projectId: string }>;

// POST /api/projects/[projectId]/documents
// Хоосон document (Google-Docs маягийн баримт) үүсгэнэ — R2 binary биш,
// агуулга нь Liveblocks/collaborative editor дотор амьдарна.
export const POST = withApiError(async function POST(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { projectId } = await context.params;
  const membership = await requireProjectRole(projectId, user, "EDITOR");
  if (!membership) return jsonError("Баримт үүсгэх эрхгүй.", 403);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { visibility: true },
  });

  const body = await req.json().catch(() => ({}));
  const rawName = typeof body.name === "string" ? body.name.trim() : "";
  const name = (rawName || "Untitled document").slice(0, 120);

  // folderId өгвөл тухайн project-д харьяалагдаж байгаа эсэхийг шалгана
  let folderId: string | null = null;
  if (typeof body.folderId === "string" && body.folderId) {
    const parent = await prisma.folder.findUnique({
      where: { id: body.folderId },
      select: { projectId: true },
    });
    if (parent?.projectId === projectId) folderId = body.folderId;
  }

  const file = await prisma.projectFile.create({
    data: {
      projectId,
      folderId,
      name,
      mimeType: "text/html", // browser дотор засагдана
      folder: "documents",
      editorIds: [user.id],
      uploaderId: user.id,
      content: {
        type: "doc",
        content: [{ type: "paragraph" }],
      },
    },
    include: {
      uploader: { select: { id: true, email: true, nickname: true } },
      lockedBy: { select: { id: true, email: true, nickname: true } },
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: {
          id: true,
          versionNumber: true,
          fileSize: true,
          checksum: true,
          commitMsg: true,
          createdAt: true,
        },
      },
      _count: { select: { comments: true, versions: true } },
    },
  });

  await prisma.fileActivity.create({
    data: { fileId: file.id, userId: user.id, action: "UPLOAD", ...getClientInfo(req) },
  });

  return NextResponse.json(
    { file: serializeJson({ ...file, openMode: "browser" }) },
    { status: 201 },
  );
});
