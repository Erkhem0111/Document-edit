import {
  withApiError,
  getClientInfo,
  jsonError,
  requireProjectRole,
  requireUser,
  serializeJson,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  buildObjectKey,
  computeChecksum,
  getPublicUrl,
  uploadToR2,
} from "@/lib/r2";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { MAX_UPLOAD_BYTES } from "@/lib/upload";
import crypto from "crypto";

type Params = Promise<{ fileId: string }>;

export const GET = withApiError(async function GET(
  _req: Request,
  context: { params: Params },
) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { fileId } = await context.params;

  const file = await prisma.projectFile.findUnique({
    where: { id: fileId },
    include: {
      project: {
        select: {
          visibility: true,
        },
      },
    },
  });

  if (!file) {
    return jsonError("Файл олдсонгүй.", 404);
  }

  const membership = await requireProjectRole(
    file.projectId,
    user,
    "VIEWER",
  );

  if (!membership) {
    return jsonError("Version харах эрхгүй.", 403);
  }

  const versions = await prisma.fileVersion.findMany({
    where: { fileId },
    orderBy: { versionNumber: "desc" },
    select: {
      id: true,
      versionNumber: true,
      fileSize: true,
      checksum: true,
      commitMsg: true,
      createdAt: true,
      uploadedBy: {
        select: {
          id: true,
          email: true,
          nickname: true,
        },
      },
    },
  });

  return NextResponse.json({
    versions: serializeJson(versions),
  });
});

export const POST = withApiError(async function POST(
  req: Request,
  context: { params: Params },
) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { fileId } = await context.params;

  const file = await prisma.projectFile.findUnique({
    where: { id: fileId },
    include: {
      project: {
        select: {
          visibility: true,
        },
      },
    },
  });

  if (!file) {
    return jsonError("Файл олдсонгүй.", 404);
  }

  const membership = await requireProjectRole(
    file.projectId,
    user,
    "EDITOR",
  );

  if (!membership) {
    return jsonError("Version upload хийх эрхгүй.", 403);
  }

  if (file.project.visibility === "REFERENCE") {
    return jsonError(
      "Reference folder read-only тул version upload хийх боломжгүй.",
      403,
    );
  }

  if (
    file.isLocked &&
    file.lockedById !== user.id &&
    user.role !== "ADMIN"
  ) {
    return jsonError(
      "Файл өөр хэрэглэгч дээр lock-той байна.",
      423,
    );
  }

  const formData = await req.formData();
  const upload = formData.get("file");
  const commitMsg = formData.get("commitMsg");

  if (!(upload instanceof File)) {
    return jsonError("Upload хийх файл шаардлагатай.", 400);
  }

  if (upload.size > MAX_UPLOAD_BYTES) {
    return jsonError(
      "Файл хэтэрхий том байна (дээд тал нь 50MB).",
      413,
    );
  }

  const bytes = Buffer.from(await upload.arrayBuffer());
  const checksum = computeChecksum(bytes);

  const version = await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      // --------------------------------------------------
      // 1. ProjectFile row-г lock хийнэ.
      //
      // Нэг file дээр зэрэг upload ирвэл:
      //
      // Request A → LOCK
      // Request B → WAIT
      //
      // A transaction дууссаны дараа B lock авна.
      // --------------------------------------------------
      await tx.$queryRaw`
        SELECT id
        FROM "ProjectFile"
        WHERE id = ${fileId}
        FOR UPDATE
      `;

      // --------------------------------------------------
      // 2. LOCK авсны дараа latest version-ийг уншина.
      // --------------------------------------------------
      const latest = await tx.fileVersion.findFirst({
        where: { fileId },
        orderBy: {
          versionNumber: "desc",
        },
        select: {
          versionNumber: true,
        },
      });

      const versionNumber =
        (latest?.versionNumber ?? 0) + 1;

      // --------------------------------------------------
      // 3. R2 object key-г unique болгоно.
      // --------------------------------------------------
const uploadId = crypto.randomUUID();

const objectKey = buildObjectKey(
  file.projectId,
  fileId,
  versionNumber,
  uploadId,
);

      // --------------------------------------------------
      // 4. R2 upload
      // --------------------------------------------------
      try {
        await uploadToR2({
          buffer: bytes,
          objectKey,
          mimeType:
            upload.type || "application/octet-stream",
        });
      } catch (err) {
        console.error("R2 upload failed:", err);

        throw new Error("R2_UPLOAD_FAILED");
      }

      const fileUrl = getPublicUrl(objectKey);

      // --------------------------------------------------
      // 5. DB дээр version үүсгэнэ.
      // @@unique([fileId, versionNumber])
      // мөн давхар хамгаална.
      // --------------------------------------------------
      const created = await tx.fileVersion.create({
        data: {
          fileId,
          uploadedById: user.id,
          versionNumber,
          objectKey,
          fileUrl,
          fileSize: BigInt(bytes.length),
          checksum,
          commitMsg:
            typeof commitMsg === "string" &&
            commitMsg.trim()
              ? commitMsg.trim()
              : null,
        },
        select: {
          id: true,
          versionNumber: true,
          fileSize: true,
          checksum: true,
          commitMsg: true,
          createdAt: true,
          uploadedBy: {
            select: {
              id: true,
              email: true,
              nickname: true,
            },
          },
        },
      });

      // --------------------------------------------------
      // 6. Current file metadata update
      // --------------------------------------------------
      await tx.projectFile.update({
        where: {
          id: fileId,
        },
        data: {
          name: upload.name || file.name,
          mimeType: upload.type || file.mimeType,
        },
      });

      // --------------------------------------------------
      // 7. Activity
      // --------------------------------------------------
      await tx.fileActivity.create({
        data: {
          fileId,
          userId: user.id,
          action: "UPLOAD",
          ...getClientInfo(req),
        },
      });

      return created;
    },
    {
      timeout: 60_000,
    },
  );

  return NextResponse.json(
    {
      version: serializeJson(version),
    },
    {
      status: 201,
    },
  );
});