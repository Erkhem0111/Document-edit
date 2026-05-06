import {
  jsonError,
  requireProjectRole,
  requireUser,
  serializeJson,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type Params = Promise<{ projectId: string }>;

export async function GET(_req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { projectId } = await context.params;
  const membership = await requireProjectRole(projectId, user, "VIEWER");
  if (!membership) return jsonError("Энэ төсөлд хандах эрхгүй.", 403);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              nickname: true,
              avatarUrl: true,
            },
          },
        },
      },
      files: {
        include: {
          uploader: {
            select: {
              id: true,
              email: true,
              nickname: true,
              avatarUrl: true,
            },
          },
          lockedBy: {
            select: {
              id: true,
              email: true,
              nickname: true,
              avatarUrl: true,
            },
          },
          versions: {
            orderBy: { versionNumber: "desc" },
            take: 1,
          },
          _count: {
            select: { comments: true, versions: true },
          },
        },
        orderBy: { updatedAt: "desc" },
      },
      tasks: {
        include: {
          assignee: { select: { id: true, email: true, nickname: true } },
          creator: { select: { id: true, email: true, nickname: true } },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  if (!project) return jsonError("Төсөл олдсонгүй.", 404);

  return NextResponse.json({ project: serializeJson(project) });
}

export async function PATCH(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { projectId } = await context.params;
  const membership = await requireProjectRole(projectId, user, "OWNER");
  if (!membership) return jsonError("Төсөл засах эрхгүй.", 403);

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  const description =
    typeof body.description === "string" ? body.description.trim() : undefined;
  const isArchived =
    typeof body.isArchived === "boolean" ? body.isArchived : undefined;

  if (name !== undefined && !name) {
    return jsonError("Төслийн нэр хоосон байж болохгүй.", 400);
  }

  const project = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(isArchived !== undefined ? { isArchived } : {}),
    },
  });

  return NextResponse.json({ project });
}

export async function DELETE(_req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { projectId } = await context.params;
  const membership = await requireProjectRole(projectId, user, "OWNER");
  if (!membership) return jsonError("Төсөл устгах эрхгүй.", 403);

  await prisma.project.update({
    where: { id: projectId },
    data: { isArchived: true },
  });

  return NextResponse.json({ message: "Төсөл архивлагдлаа." });
}
