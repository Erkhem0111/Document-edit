import { jsonError, requireProjectRole, requireUser, serializeJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { TaskPriority, TaskStatus } from "@prisma/client";

const STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
const PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export async function GET(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  if (projectId) {
    const membership = await requireProjectRole(projectId, user, "VIEWER");
    if (!membership) return jsonError("Task харах эрхгүй.", 403);
  }

  const tasks = await prisma.task.findMany({
    where:
      projectId
        ? { projectId }
        : user.role === "ADMIN"
          ? {}
          : {
              project: {
                members: {
                  some: { userId: user.id },
                },
              },
            },
    orderBy: { updatedAt: "desc" },
    include: {
      project: { select: { id: true, name: true } },
      assignee: { select: { id: true, email: true, nickname: true } },
      creator: { select: { id: true, email: true, nickname: true } },
    },
  });

  return NextResponse.json({ tasks: serializeJson(tasks) });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const body = await req.json();
  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : null;
  const assigneeId =
    typeof body.assigneeId === "string" && body.assigneeId
      ? body.assigneeId
      : user.id;
  const priority = PRIORITIES.includes(body.priority) ? body.priority : "MEDIUM";
  const status = STATUSES.includes(body.status) ? body.status : "TODO";
  const dueDate =
    typeof body.dueDate === "string" && body.dueDate
      ? new Date(body.dueDate)
      : null;

  if (!projectId || !title) return jsonError("Project болон task нэр шаардлагатай.", 400);

  const membership = await requireProjectRole(projectId, user, "EDITOR");
  if (!membership) return jsonError("Task үүсгэх эрхгүй.", 403);

  const task = await prisma.task.create({
    data: {
      projectId,
      title,
      description,
      assigneeId,
      creatorId: user.id,
      priority,
      status,
      dueDate,
    },
    include: {
      project: { select: { id: true, name: true } },
      assignee: { select: { id: true, email: true, nickname: true } },
      creator: { select: { id: true, email: true, nickname: true } },
    },
  });

  return NextResponse.json({ task: serializeJson(task) }, { status: 201 });
}
