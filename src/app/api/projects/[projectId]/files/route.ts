import {
  withApiError,
  getClientInfo,
  getFileFolder,
  isEditableInBrowser,
  isExternalEngineeringFile,
  jsonError,
  requireProjectRole,
  requireUser,
  serializeJson,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getEditableUploadContent } from "@/lib/editable-upload";
import {
  buildObjectKey,
  computeChecksum,
  getPublicUrl,
  uploadToR2,
} from "@/lib/r2";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

type Params = Promise<{ projectId: string }>;

function getOpenMode(mimeType: string, name: string) {
  if (isExternalEngineeringFile(mimeType, name)) return "external";
  if (isEditableInBrowser(mimeType, name)) return "browser";
  return "download";
}

function parseIds(value: FormDataEntryValue | null) {
  return typeof value === "string" && value ? value.split(",").filter(Boolean) : [];
}

function cleanFolderName(value: FormDataEntryValue | null, fallback: string) {
  const raw = typeof value === "string" ? value.trim() : "";
  const name = raw || fallback;
  return name.replace(/[\\/<>:"|?*]+/g, "-").slice(0, 80);
}

// folderId өгвөл тухайн project-д харьяалагдаж байгаа эсэхийг шалгаад буцаана
async function resolveFolderId(
  value: FormDataEntryValue | null,
  projectId: string,
): Promise<string | null> {
  const id = typeof value === "string" && value ? value : null;
  if (!id) return null;
  const folder = await prisma.folder.findUnique({
    where: { id },
    select: { projectId: true },
  });
  return folder && folder.projectId === projectId ? id : null;
}

// ─── GET /api/projects/[projectId]/files ─────────────────────────────────────

export const GET = withApiError(async function GET(_req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { projectId } = await context.params;
  const membership = await requireProjectRole(projectId, user, "VIEWER");
  if (!membership) return jsonError("Файл харах эрхгүй.", 403);

  // Файл нь project-ийн хандалтыг өвлөнө — project-ийг харж чадвал бүх файлыг харна
  const files = await prisma.projectFile.findMany({
    where: { projectId },
    orderBy: { updatedAt: "desc" },
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

  const shaped = files.map((file) => ({
    ...file,
    openMode: getOpenMode(file.mimeType, file.name),
  }));

  return NextResponse.json({ files: serializeJson(shaped) });
});

// ─── POST /api/projects/[projectId]/files ────────────────────────────────────
// Өмнө: файлын байтыг DB-д fileData: bytes хэлбэрээр хадгалдаг байсан
//       → DB хэмжээ хурдан өснө, query удааширна, backup аюултай болно
// Одоо: R2-д upload хийгээд fileUrl-д object key хадгална
//       → DB зөвхөн metadata хадгална, файл R2-д байна

export const POST = withApiError(async function POST(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { projectId } = await context.params;
  const membership = await requireProjectRole(projectId, user, "EDITOR");
  if (!membership) return jsonError("Файл upload хийх эрхгүй.", 403);
  const formData = await req.formData();
  const upload = formData.get("file");
  if (!(upload instanceof File)) return jsonError("Upload хийх файл шаардлагатай.", 400);

  const folder = cleanFolderName(formData.get("folder"), getFileFolder(upload.name));
  const viewerIds = parseIds(formData.get("viewerIds"));
  const editorIds = Array.from(new Set([user.id, ...parseIds(formData.get("editorIds"))]));
  const commitMsg = formData.get("commitMsg");
  const folderId = await resolveFolderId(formData.get("folderId"), projectId);

  const bytes = Buffer.from(await upload.arrayBuffer());
  const checksum = computeChecksum(bytes);
  const clientInfo = getClientInfo(req);
  const mimeType = upload.type || "application/octet-stream";
  const editableContent = await getEditableUploadContent({
    buffer: bytes,
    fileName: upload.name,
    mimeType,
  });

  // Эхлээд DB-д файл үүсгэнэ — id авахын тулд
  // Дараа нь тэр id-г ашиглан R2-д object key үүсгэнэ
  const createdFile = await prisma.projectFile.create({
    data: {
      projectId,
      folderId,
      name: upload.name,
      mimeType,
      folder,
      viewerIds,
      editorIds,
      uploaderId: user.id,
      content: editableContent as Prisma.InputJsonValue | undefined,
    },
  });

  const objectKey = buildObjectKey(projectId, createdFile.id, 1);

  // R2 upload амжилтгүй болвол DB-д үүссэн файлыг буцааж устгана
  // → DB болон R2 хоорондын өгөгдөл зөрөхөөс сэргийлнэ
  try {
    await uploadToR2({ buffer: bytes, objectKey, mimeType });
  } catch (err) {
    await prisma.projectFile.delete({ where: { id: createdFile.id } }).catch(() => null);
    console.error("R2 upload failed:", err);
    return jsonError(
      "Файлыг cloud storage (R2)-д хадгалж чадсангүй. R2 API token-ы эрх (Object Read & Write) болон bucket тохиргоог шалгана уу.",
      502,
    );
  }

  const fileUrl = getPublicUrl(objectKey);

  const file = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.fileVersion.create({
      data: {
        fileId: createdFile.id,
        uploadedById: user.id,
        versionNumber: 1,
        fileUrl,                        // ← R2 public URL
        fileSize: BigInt(bytes.length),
        checksum,
        commitMsg: typeof commitMsg === "string" && commitMsg.trim() ? commitMsg.trim() : null,
      },
    });

    await tx.fileActivity.create({
      data: { fileId: createdFile.id, userId: user.id, action: "UPLOAD", ...clientInfo },
    });

    return tx.projectFile.findUniqueOrThrow({
      where: { id: createdFile.id },
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
  });

  return NextResponse.json(
    {
      file: serializeJson({
        ...file,
        openMode: editableContent ? "browser" : getOpenMode(file.mimeType, file.name),
      }),
    },
    { status: 201 },
  );
});
