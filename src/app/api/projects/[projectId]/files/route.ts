import {
  getClientInfo,
  getAccessibleProjectFileIds,
  getFileFolder,
  isEditableInBrowser,
  isExternalEngineeringFile,
  jsonError,
  requireProjectRole,
  requireUser,
  serializeJson,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
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

export async function GET(_req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { projectId } = await context.params;
  const membership = await requireProjectRole(projectId, user, "VIEWER");
  if (!membership) return jsonError("Файл харах эрхгүй.", 403);
  const accessibleIds = await getAccessibleProjectFileIds(projectId, user);

  const files = await prisma.projectFile.findMany({
    where: {
      projectId,
      ...(accessibleIds ? { id: { in: accessibleIds } } : {}),
    },
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
}

export async function POST(req: Request, context: { params: Params }) {
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

  const bytes = Buffer.from(await upload.arrayBuffer());
  const checksum = crypto.createHash("sha256").update(bytes).digest("hex");

  const clientInfo = getClientInfo(req);
  const file = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const createdFile = await tx.projectFile.create({
      data: {
        projectId,
        name: upload.name,
        mimeType: upload.type || "application/octet-stream",
        uploaderId: user.id,
      },
    });

    await tx.$executeRaw`
      UPDATE "ProjectFile"
      SET "folder" = ${folder},
          "viewerIds" = ${viewerIds},
          "editorIds" = ${editorIds}
      WHERE id = ${createdFile.id}
    `;

    const createdVersion = await tx.fileVersion.create({
      data: {
        fileId: createdFile.id,
        uploadedById: user.id,
        versionNumber: 1,
        fileUrl: `db:${checksum}`,
        fileSize: BigInt(bytes.length),
        checksum,
        commitMsg: typeof commitMsg === "string" && commitMsg.trim() ? commitMsg.trim() : null,
      },
    });

    await tx.$executeRaw`
      UPDATE "FileVersion"
      SET "fileData" = ${bytes}
      WHERE id = ${createdVersion.id}
    `;

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
    { file: serializeJson({ ...file, openMode: getOpenMode(file.mimeType, file.name) }) },
    { status: 201 },
  );
}
