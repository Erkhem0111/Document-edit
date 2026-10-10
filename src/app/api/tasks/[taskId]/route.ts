import {
  getProjectMembership,
  jsonError,
  requireProjectRole,
  requireUser,
  serializeJson,
  withApiError,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getAppOrigin, notifyTaskAssigned } from "@/lib/notify";
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
  // Засах эрхгүй ч оноогдсон хүн төлвөө өөрчилж болно — гэхдээ төсөлдөө
  // хандах эрхтэй хэвээр байх ёстой (хасагдсан хүн биш)
  if (
    !membership &&
    (task.assigneeId !== user.id || !(await requireProjectRole(task.projectId, user, "VIEWER")))
  ) {
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
  if (dueDate && Number.isNaN(dueDate.getTime())) return jsonError("Хугацааны огноо буруу байна.", 400);

  // Төслийн EDITOR биш, зөвхөн оноогдсон хүн бол зөвхөн төлөвөө шинэчилнэ
  if (
    !membership &&
    [title, description, assigneeId, priority, dueDate].some((v) => v !== undefined)
  ) {
    return jsonError("Танд зөвхөн task-ийн төлөвийг өөрчлөх эрх байна.", 403);
  }

  // Assignee солих бол шинэ assignee нь төслийн гишүүн байх ёстой
  if (assigneeId !== undefined && assigneeId !== task.assigneeId) {
    const assigneeMembership = await getProjectMembership(task.projectId, assigneeId);
    if (!assigneeMembership) {
      return jsonError("Assignee нь энэ төслийн гишүүн биш байна.", 400);
    }
  }

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
      project: {
        select: {
          id: true,
          name: true,
          visibility: true,
          isArchived: true,
          trashedAt: true,
        },
      },
      assignee: { select: { id: true, email: true, nickname: true } },
      creator: { select: { id: true, email: true, nickname: true } },
    },
  });

  // Шинэ хүнд оноосон бол түүнд мэдэгдэнэ
  if (
    assigneeId !== undefined &&
    assigneeId !== task.assigneeId &&
    updated.assignee &&
    updated.assignee.id !== user.id
  ) {
    notifyTaskAssigned({
      origin: getAppOrigin(req),
      actor: user,
      assignee: updated.assignee,
      task: updated,
      projectName: updated.project.name,
    });
  }

  return NextResponse.json({ task: serializeJson(updated) });
});

export const DELETE = withApiError(async function DELETE(_req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { taskId } = await context.params;
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return jsonError("Task олдсонгүй.", 404);

  // Даалгаврыг үүсгэсэн хүн эсвэл төслийн эзэн (админ) устгана
  if (task.creatorId !== user.id) {
    const membership = await requireProjectRole(task.projectId, user, "OWNER");
    if (!membership) return jsonError("Task устгах эрхгүй.", 403);
  }

  await prisma.task.delete({ where: { id: taskId } });

  return NextResponse.json({ message: "Task устгагдлаа." });
});
