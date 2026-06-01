import { jsonError, requireProjectRole, requireUser, serializeJson, withApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { TaskPriority, TaskStatus } from "@/types/domain";

type Params = Promise<{ taskId: string }>;

const STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
const PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export const PATCH = withApiError(async function PATCH(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { taskId } = await context.params;
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return jsonError("Task олдсонгүй.", 404);

  const membership = await requireProjectRole(task.projectId, user, "EDITOR");
  if (!membership && task.assigneeId !== user.id) {
    return jsonError("Task засах эрхгүй.", 403);
  }

  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : undefined;
  const description =
    typeof body.description === "string" ? body.description.trim() : undefined;
  const assigneeId =
    typeof body.assigneeId === "string" ? body.assigneeId : undefined;
  const status = STATUSES.includes(body.status) ? body.status : undefined;
  const priority = PRIORITIES.includes(body.priority) ? body.priority : undefined;
  const dueDate =
    typeof body.dueDate === "string"
      ? body.dueDate
        ? new Date(body.dueDate)
        : null
      : undefined;

  if (title !== undefined && !title) return jsonError("Task нэр хоосон байж болохгүй.", 400);

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(assigneeId !== undefined ? { assigneeId } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(priority !== undefined ? { priority } : {}),
      ...(dueDate !== undefined ? { dueDate } : {}),
    },
    include: {
      project: { select: { id: true, name: true } },
      assignee: { select: { id: true, email: true, nickname: true } },
      creator: { select: { id: true, email: true, nickname: true } },
    },
  });

  return NextResponse.json({ task: serializeJson(updated) });
});

export const DELETE = withApiError(async function DELETE(_req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { taskId } = await context.params;
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return jsonError("Task олдсонгүй.", 404);

  const membership = await requireProjectRole(task.projectId, user, "OWNER");
  if (!membership) return jsonError("Task устгах эрхгүй.", 403);

  await prisma.task.delete({ where: { id: taskId } });

  return NextResponse.json({ message: "Task устгагдлаа." });
});
