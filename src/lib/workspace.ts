import { prisma } from "@/lib/prisma";
import { getClientInfo, type ApiUser } from "@/lib/api";
import type { Prisma } from "@prisma/client";

// ─── Хувийн ажлын орчин ("Миний баримтууд") ──────────────────────────────────
// "Шинэ баримт" товчийг төсөл сонгохгүйгээр дарахад баримт энд үүснэ.
// Хэрэглэгчийн эзэмшдэг хамгийн анхны идэвхтэй PRIVATE төслийг ашиглана,
// байхгүй бол шинээр үүсгэнэ.
export async function ensurePersonalWorkspace(userId: string) {
  const where: Prisma.ProjectWhereInput = {
    visibility: "PRIVATE",
    trashedAt: null,
    members: { some: { userId, role: "OWNER" } },
  };
  const existing = await prisma.project.findFirst({
    where,
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (existing) return existing.id;

  // Анх удаа зэрэг ирсэн хоёр хүсэлт (жишээ нь файл оруулах + шинэ баримт)
  // хоёр "Миний баримтууд" үүсгэхээс сэргийлж хэрэглэгч тус бүрээр түгжинэ
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`personal-workspace:${userId}`}))`;
    const again = await tx.project.findFirst({
      where,
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (again) return again.id;
    const created = await tx.project.create({
      data: {
        name: "Миний баримтууд",
        visibility: "PRIVATE",
        members: { create: { userId, role: "OWNER" } },
      },
      select: { id: true },
    });
    return created.id;
  });
}

// Хоосон баримт (browser дотор засагдах) үүсгэнэ
export async function createBlankDocument({
  req,
  user,
  projectId,
  folderId,
  name,
  content,
}: {
  req: Request;
  user: ApiUser;
  projectId: string;
  folderId: string | null;
  name: string;
  // Өгөөгүй бол хоосон баримт (Word хөрвүүлэлт агуулгаа дамжуулна)
  content?: Prisma.InputJsonValue;
}) {
  const file = await prisma.projectFile.create({
    data: {
      projectId,
      folderId,
      name,
      mimeType: "text/html", // browser дотор засагдана
      folder: "documents",
      editorIds: [user.id],
      uploaderId: user.id,
      content:
        content ??
        ({
          type: "doc",
          content: [{ type: "paragraph" }],
        } as Prisma.InputJsonValue),
    },
    select: { id: true, projectId: true, name: true },
  });

  await prisma.fileActivity.create({
    data: { fileId: file.id, userId: user.id, action: "UPLOAD", ...getClientInfo(req) },
  });

  return file;
}
