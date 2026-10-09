import { jsonError, requireProjectRole, requireUser, withApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { downloadFromR2 } from "@/lib/r2";
import { createBlankDocument, ensurePersonalWorkspace } from "@/lib/workspace";
import { getBaseExtensions } from "@/app/editor/extensions/base";
import { generateJSON } from "@tiptap/html";
import mammoth from "mammoth";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

type Params = Promise<{ fileId: string }>;

// Хөрвүүлсэн баримтын дээд хэмжээ (contents PATCH-ийн хязгаартай ижил)
const MAX_CONTENT_CHARS = 5 * 1024 * 1024;

// POST /api/files/[fileId]/convert
// Upload хийсэн Word (.docx) файлаас засварлах боломжтой баримт үүсгэнэ.
// Анхны .docx файл хэвээр үлдэнэ — шинэ баримт хажууд нь үүснэ. Тухайн төсөлд
// засах эрхгүй (эсвэл Reference) бол "Миний баримтууд"-д үүснэ.
export const POST = withApiError(async function POST(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { fileId } = await context.params;
  const file = await prisma.projectFile.findUnique({
    where: { id: fileId },
    select: {
      id: true,
      name: true,
      projectId: true,
      folderId: true,
      project: { select: { visibility: true } },
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: { objectKey: true },
      },
    },
  });
  if (!file) return jsonError("Файл олдсонгүй.", 404);
  if (!file.name.toLowerCase().endsWith(".docx")) {
    return jsonError("Зөвхөн .docx (Word) файлыг хөрвүүлнэ.", 400);
  }

  const canView = await requireProjectRole(file.projectId, user, "VIEWER");
  if (!canView) return jsonError("Энэ файлыг харах эрхгүй.", 403);
  const latest = file.versions[0];
  if (!latest) return jsonError("Файлын агуулга олдсонгүй.", 404);

  const buffer = await downloadFromR2(latest.objectKey);
  let html: string;
  try {
    ({ value: html } = await mammoth.convertToHtml({ buffer }));
  } catch {
    return jsonError("Word файлыг уншиж чадсангүй. Файл эвдэрсэн эсэхийг шалгана уу.", 422);
  }

  const content = generateJSON(html, getBaseExtensions({ collaborative: false }));
  if (JSON.stringify(content).length > MAX_CONTENT_CHARS) {
    return jsonError("Баримт хэтэрхий том тул хөрвүүлэх боломжгүй.", 413);
  }

  // Ижил төсөлд (засах эрхтэй бол), эс бөгөөс хувийн орчинд
  const canEdit =
    file.project.visibility !== "REFERENCE" &&
    (await requireProjectRole(file.projectId, user, "EDITOR"));
  const targetProjectId = canEdit ? file.projectId : await ensurePersonalWorkspace(user.id);

  const created = await createBlankDocument({
    req,
    user,
    projectId: targetProjectId,
    folderId: canEdit ? file.folderId : null,
    name: file.name.replace(/\.docx$/i, "").slice(0, 120),
    content: content as Prisma.InputJsonValue,
  });

  return NextResponse.json({ file: created }, { status: 201 });
});
