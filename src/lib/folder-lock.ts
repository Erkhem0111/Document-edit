import type { Prisma } from "@prisma/client";

// Нэг төслийн хавтасны модыг өөрчлөх үйлдлүүдийг (зөөх, устгах, "байхгүй бол
// үүсгэх") ээлжлүүлнэ. Lock нь transaction дуусахад автоматаар суларна.
export async function lockFolderTree(tx: Prisma.TransactionClient, projectId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`folder-tree:${projectId}`}))`;
}
