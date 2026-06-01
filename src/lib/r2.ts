import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

// ─── Client ──────────────────────────────────────────────────────────────────

if (!process.env.R2_ENDPOINT) throw new Error("R2_ENDPOINT тохируулаагүй байна.");
if (!process.env.R2_ACCESS_KEY_ID) throw new Error("R2_ACCESS_KEY_ID тохируулаагүй байна.");
if (!process.env.R2_SECRET_ACCESS_KEY) throw new Error("R2_SECRET_ACCESS_KEY тохируулаагүй байна.");

export const r2 = new S3Client({
  region: process.env.R2_REGION ?? "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET ?? "tls-files";
const PUBLIC_URL = process.env.R2_PUBLIC_URL ?? "";

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Файлын checksum тооцоолох — FileVersion.checksum-д хадгална
export function computeChecksum(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

// Object key үүсгэх — projectId/fileId/version гэсэн бүтэцтэй
export function buildObjectKey(projectId: string, fileId: string, version: number): string {
  return `projects/${projectId}/${fileId}/v${version}`;
}

// Public URL буцаах — DB-д хадгалж, хэрэглэгчид харуулна
export function getPublicUrl(objectKey: string): string {
  return `${PUBLIC_URL}/${objectKey}`;
}

// ─── Upload ──────────────────────────────────────────────────────────────────

export async function uploadToR2({
  buffer,
  objectKey,
  mimeType,
}: {
  buffer: Buffer;
  objectKey: string;
  mimeType: string;
}): Promise<void> {
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: objectKey,
      Body: buffer,
      ContentType: mimeType,
    }),
  );
}

// ─── Delete ──────────────────────────────────────────────────────────────────

export async function deleteFromR2(objectKey: string): Promise<void> {
  await r2.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: objectKey,
    }),
  );
}

// ─── Presigned download URL ───────────────────────────────────────────────────
// Хэрэглэгч файл татаж авахад шууд public URL биш,
// 1 цагийн хугацаатай signed URL өгнө — аюулгүй байдлын үүднээс
export async function getPresignedDownloadUrl(
  objectKey: string,
  expiresIn = 3600,
): Promise<string> {
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  return getSignedUrl(r2, new GetObjectCommand({ Bucket: BUCKET, Key: objectKey }), {
    expiresIn,
  });
}