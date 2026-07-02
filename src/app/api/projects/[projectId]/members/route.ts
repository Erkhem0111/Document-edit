import {
  withApiError,
  jsonError,
  requireProjectRole,
  requireUser,
  serializeJson,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { ProjectRole } from "@/types/domain";

type Params = Promise<{ projectId: string }>;

const PROJECT_ROLES: ProjectRole[] = ["OWNER", "EDITOR", "VIEWER"];

export const GET = withApiError(async function GET(_req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { projectId } = await context.params;
  const membership = await requireProjectRole(projectId, user, "VIEWER");
  if (!membership) return jsonError("Гишүүд харах эрхгүй.", 403);

  const members = await prisma.projectMember.findMany({
    where: { projectId },
    orderBy: { joinedAt: "asc" },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          nickname: true,
          avatarUrl: true,
          role: true,
        },
      },
    },
  });

  return NextResponse.json({ members: serializeJson(members) });
});

export const POST = withApiError(async function POST(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { projectId } = await context.params;
  const membership = await requireProjectRole(projectId, user, "OWNER");
  if (!membership) return jsonError("Гишүүн нэмэх эрхгүй.", 403);

  // Private folder хатуу нууц — гишүүн нэмэхийг хориглоно
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { visibility: true },
  });
  if (project?.visibility === "PRIVATE") {
    return jsonError("Private folder-т гишүүн нэмэх боломжгүй.", 400);
  }

  const body = await req.json();
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = PROJECT_ROLES.includes(body.role) ? body.role : "VIEWER";

  if (!email) return jsonError("И-мэйл шаардлагатай.", 400);

  const memberUser = await prisma.user.findUnique({ where: { email } });
  if (!memberUser) return jsonError("Ийм и-мэйлтэй хэрэглэгч олдсонгүй.", 404);

  const member = await prisma.projectMember.upsert({
    where: {
      projectId_userId: {
        projectId,
        userId: memberUser.id,
      },
    },
    create: {
      projectId,
      userId: memberUser.id,
      role,
    },
    update: { role },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          nickname: true,
          avatarUrl: true,
          role: true,
        },
      },
    },
  });

  return NextResponse.json({ member: serializeJson(member) }, { status: 201 });
});
