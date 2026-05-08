import { jsonError, requireProjectRole, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { ProjectRole } from "@/types/domain";

type Params = Promise<{ projectId: string; memberId: string }>;

const PROJECT_ROLES: ProjectRole[] = ["OWNER", "EDITOR", "VIEWER"];

export async function PATCH(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { projectId, memberId } = await context.params;
  const membership = await requireProjectRole(projectId, user, "OWNER");
  if (!membership) return jsonError("Гишүүний эрх өөрчлөх эрхгүй.", 403);

  const body = await req.json();
  const role = PROJECT_ROLES.includes(body.role) ? body.role : null;
  if (!role) return jsonError("Зөв role сонгоно уу.", 400);

  const member = await prisma.projectMember.update({
    where: { id: memberId, projectId },
    data: { role },
  });

  return NextResponse.json({ member });
}

export async function DELETE(_req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { projectId, memberId } = await context.params;
  const membership = await requireProjectRole(projectId, user, "OWNER");
  if (!membership) return jsonError("Гишүүн хасах эрхгүй.", 403);

  const ownerCount = await prisma.projectMember.count({
    where: { projectId, role: "OWNER" },
  });
  const target = await prisma.projectMember.findUnique({
    where: { id: memberId },
  });

  if (target?.role === "OWNER" && ownerCount <= 1) {
    return jsonError("Сүүлийн OWNER-г хасах боломжгүй.", 400);
  }

  await prisma.projectMember.delete({
    where: { id: memberId, projectId },
  });

  return NextResponse.json({ message: "Гишүүн хасагдлаа." });
}
