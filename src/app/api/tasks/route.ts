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
import type { Prisma } from "@prisma/client";

const STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
const PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

function getVisibleTaskProjectWhere(user: { id: string; role?: string }): Prisma.ProjectWhereInput {
  if (user.role === "ADMIN") {
    return {
      trashedAt: null,
      OR: [
        { visibility: { not: "PRIVATE" } },
        {
          visibility: "PRIVATE",
          members: { some: { userId: user.id, role: "OWNER" } },
        },
      ],
    };
  }

  return {
    trashedAt: null,
    OR: [
      {
        visibility: "PRIVATE",
        members: { some: { userId: user.id, role: "OWNER" } },
      },
      {
        visibility: "SHARED",
        members: { some: { userId: user.id } },
      },
      { visibility: { in: ["PUBLIC", "REFERENCE"] } },
    ],
  };
}

export const GET = withApiError(async function GET(req: Request) {
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
        : {
            // "Миний даалгавар": харж болох төслүүдээс зөвхөн надад хамааралтай нь —
            // надад оноогдсон, миний үүсгэсэн, эсвэл миний гишүүн төслийнх.
            // (Өмнө нь Public/Reference дахь бүх хүний даалгавар ирдэг байсан.)
            project: getVisibleTaskProjectWhere(user),
            OR: [
              { assigneeId: user.id },
              { creatorId: user.id },
              { project: { members: { some: { userId: user.id } } } },
            ],
          },
    orderBy: { updatedAt: "desc" },
    take: 500,
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

  return NextResponse.json({ tasks: serializeJson(tasks) });
});

export const POST = withApiError(async function POST(req: Request) {
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
  if (dueDate && Number.isNaN(dueDate.getTime())) return jsonError("Хугацааны огноо буруу байна.", 400);

  const membership = await requireProjectRole(projectId, user, "EDITOR");
  if (!membership) return jsonError("Task үүсгэх эрхгүй.", 403);

  // Assignee нь тухайн төслийн гишүүн байх ёстой
  if (assigneeId !== user.id) {
    const assigneeMembership = await getProjectMembership(projectId, assigneeId);
    if (!assigneeMembership) {
      return jsonError("Assignee нь энэ төслийн гишүүн биш байна.", 400);
    }
  }

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

  if (task.assignee && task.assignee.id !== user.id) {
    notifyTaskAssigned({
      origin: getAppOrigin(req),
      actor: user,
      assignee: task.assignee,
      task,
      projectName: task.project.name,
    });
  }

  return NextResponse.json({ task: serializeJson(task) }, { status: 201 });
});
