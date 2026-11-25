import { jsonError, requireProjectRole, requireUser, withApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import type { ProjectRole } from "@/types/domain";

type Params = Promise<{ projectId: string; memberId: string }>;

const PROJECT_ROLES: ProjectRole[] = ["OWNER", "EDITOR", "VIEWER"];

// Төслийн бүх эзний мөрийг transaction дуустал түгжээд тоог нь буцаана.
// Зэрэг ирсэн өөр хүсэлт энд хүлээж, эхнийх нь commit хийсний дараа шинэ
// төлөвөөр дахин тоолно.
async function lockOwners(tx: Prisma.TransactionClient, projectId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "ProjectMember"
    WHERE "projectId" = ${projectId} AND role = 'OWNER'
    FOR UPDATE`;
  return rows.length;
}

export const PATCH = withApiError(async function PATCH(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { projectId, memberId } = await context.params;
  const membership = await requireProjectRole(projectId, user, "OWNER");
  if (!membership) return jsonError("Гишүүний эрх өөрчлөх эрхгүй.", 403);

  const body = await req.json();
  const role = PROJECT_ROLES.includes(body.role) ? body.role : null;
  if (!role) return jsonError("Зөв role сонгоно уу.", 400);

  // Сүүлийн OWNER-ийн эрхийг бууруулбал төсөл эзэнгүй болно. Шалгалт ба
  // өөрчлөлтийг эзэдийн мөрийн lock дор хийнэ — хоёр эзэн бие биеэ зэрэг
  // бууруулахад нэг нь хүлээж, дахин тоолоод татгалзана.
  const result = await prisma.$transaction(async (tx) => {
    const owners = await lockOwners(tx, projectId);
    const target = await tx.projectMember.findUnique({ where: { id: memberId } });
    if (!target || target.projectId !== projectId) return { error: "Гишүүн олдсонгүй.", status: 404 };
    if (target.role === "OWNER" && role !== "OWNER" && owners <= 1) {
      return { error: "Сүүлийн OWNER-ийн эрхийг бууруулах боломжгүй.", status: 400 };
    }
    return { member: await tx.projectMember.update({ where: { id: memberId, projectId }, data: { role } }) };
  });
  if ("error" in result) return jsonError(result.error!, result.status);

  return NextResponse.json({ member: result.member });
});

export const DELETE = withApiError(async function DELETE(_req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { projectId, memberId } = await context.params;
  const membership = await requireProjectRole(projectId, user, "OWNER");
  if (!membership) return jsonError("Гишүүн хасах эрхгүй.", 403);

  const result = await prisma.$transaction(async (tx) => {
    const owners = await lockOwners(tx, projectId);
    const target = await tx.projectMember.findUnique({ where: { id: memberId } });
    if (!target || target.projectId !== projectId) return { error: "Гишүүн олдсонгүй.", status: 404 };
    if (target.role === "OWNER" && owners <= 1) {
      return { error: "Сүүлийн OWNER-г хасах боломжгүй.", status: 400 };
    }
    await tx.projectMember.delete({ where: { id: memberId, projectId } });
    return { ok: true };
  });
  if ("error" in result) return jsonError(result.error!, result.status);

  return NextResponse.json({ message: "Гишүүн хасагдлаа." });
});
