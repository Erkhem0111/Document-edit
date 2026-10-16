import {
  S3Client,
  PutObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
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

// Object key үүсгэх — projectId/fileId/version/uniqueId бүтэцтэй
export function buildObjectKey(
  projectId: string,
  fileId: string,
  version: number,
  uploadId?: string,
): string {
  const suffix = uploadId ? `-${uploadId}` : "";

  return `projects/${projectId}/${fileId}/v${version}${suffix}`;
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

// Объектыг шинэ түлхүүр рүү хуулна — файлыг өөр project руу зөөхөд
// объектын зам projectId агуулдаг тул хуулж байж шилжүүлнэ.
export async function copyInR2(sourceKey: string, destKey: string): Promise<void> {
  await r2.send(
    new CopyObjectCommand({
      Bucket: BUCKET,
      CopySource: `${BUCKET}/${sourceKey}`,
      Key: destKey,
    }),
  );
}

// ─── Шууд upload (browser → R2) ──────────────────────────────────────────────
// Vercel нэг хүсэлтэд 4.5MB-аас том биеийг хүлээж авдаггүй тул том файлыг
// browser өөрөө R2 руу (богино хугацаатай гарын үсэгтэй холбоосоор) илгээнэ.
// Bucket-ийн CORS дээр сайтын домэйнд PUT зөвшөөрөгдсөн байх ёстой.
export async function getPresignedUploadUrl(
  objectKey: string,
  contentType: string,
  expiresIn = 15 * 60,
): Promise<string> {
  return getSignedUrl(
    r2,
    new PutObjectCommand({ Bucket: BUCKET, Key: objectKey, ContentType: contentType }),
    { expiresIn },
  );
}

// R2 дээрх объектын бодит хэмжээ (байхгүй бол null)
export async function headR2Object(
  objectKey: string,
): Promise<{ size: number; etag: string } | null> {
  try {
    const res = await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: objectKey }));
    return { size: Number(res.ContentLength ?? 0), etag: (res.ETag ?? "").replace(/"/g, "") };
  } catch {
    return null;
  }
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

export async function downloadFromR2(objectKey: string): Promise<Buffer> {
  const response = await r2.send(
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: objectKey,
    }),
  );
  if (!response.Body) return Buffer.alloc(0);
  const bytes = await response.Body.transformToByteArray();
  return Buffer.from(bytes);
}

// Монгол (кирилл) нэртэй файл зөв нэрээрээ татагдахын тулд RFC 5987-ийн
// filename*=UTF-8'' хэлбэрийг ашиглана. Хуучин browser-т ASCII нэр нөөц болно.
// (Өмнө нь filename="%D0%A2..." гэж бичигдээд файл кодлогдсон нэрээр хадгалагддаг байсан.)
function contentDisposition(type: "inline" | "attachment", fileName: string) {
  const asciiFallback = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${type}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

// ─── Presigned download URL ───────────────────────────────────────────────────
// Хэрэглэгч файл татаж авахад шууд public URL биш,
// 1 цагийн хугацаатай signed URL өгнө — аюулгүй байдлын үүднээс
export async function getPresignedDownloadUrl(
  objectKey: string,
  options: {
    fileName?: string;
    expiresIn?: number;
    inline?: boolean;
    contentType?: string;
  } = {},
): Promise<string> {
  const { fileName, expiresIn = 3600, inline = false, contentType } = options;
  return getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: objectKey,
      // inline=true бол browser дотор шууд нээгдэнэ (PDF/зураг),
      // эс бол "Download" гэдэг шиг attachment болж татагдана.
      ...(fileName
        ? {
            ResponseContentDisposition: contentDisposition(
              inline ? "inline" : "attachment",
              fileName,
            ),
          }
        : {}),
      // Хуучин хувилбарын R2 ContentType өөр байж болох тул inline үед баталгаажуулна
      ...(contentType ? { ResponseContentType: contentType } : {}),
    }),
    { expiresIn },
  );
}
