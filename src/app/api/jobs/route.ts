import {
  getVisibleProjectWhere,
  jsonError,
  requireProjectRole,
  requireUser,
  serializeJson,
  withApiError,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { generateInviteCode } from "@/lib/invite-code";
import { isJobType } from "@/lib/jobs";
import { NextResponse } from "next/server";
import { JOB_SELECT } from "@/lib/jobs-server";

// GET /api/jobs[?mine=1] — харж болох төслүүдээс ажлын мэдээлэлтэй нь.
// Хүлээлгэн өгсөн ажлаас зөвхөн сүүлийн 60 хоногийнхыг (самбар хөнгөн байна).
export const GET = withApiError(async function GET(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const mine = new URL(req.url).searchParams.get("mine") === "1";
  const since = new Date(Date.now() - 60 * 86_400_000);

  const jobs = await prisma.project.findMany({
    where: {
      AND: [
        getVisibleProjectWhere(user),
        { jobStage: { not: null } },
        {
          OR: [
            { jobStage: { not: "DELIVERED" } },
            { jobDeliveredAt: null },
            { jobDeliveredAt: { gte: since } },
          ],
        },
        ...(mine ? [{ members: { some: { userId: user.id } } }] : []),
      ],
    },
    orderBy: [{ jobDueDate: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
    take: 300,
    select: JOB_SELECT,
  });

  return NextResponse.json({ jobs: serializeJson(jobs) });
});

// POST /api/jobs { name, client, type, dueDate, projectId? }
// projectId өгвөл тэр төсөлд ажлын мэдээлэл нэмнэ, үгүй бол шинэ (Shared) төсөл үүсгэнэ.
export const POST = withApiError(async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 160) : "";
  const client = typeof body.client === "string" ? body.client.trim().slice(0, 160) : "";
  const jobType = isJobType(body.type) ? body.type : "OTHER";
  const dueDate =
    typeof body.dueDate === "string" && body.dueDate ? new Date(body.dueDate) : null;
  const projectId = typeof body.projectId === "string" && body.projectId ? body.projectId : null;

  if (dueDate && Number.isNaN(dueDate.getTime())) return jsonError("Хугацааны огноо буруу байна.", 400);

  const jobData = {
    jobStage: "ORDER" as const,
    jobType,
    jobClient: client || null,
    jobDueDate: dueDate,
    jobDeliveredAt: null,
  };

  if (projectId) {
    const membership = await requireProjectRole(projectId, user, "EDITOR");
    if (!membership) return jsonError("Энэ төсөлд ажил нэмэх эрхгүй.", 403);
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { trashedAt: true, visibility: true, jobStage: true },
    });
    if (!project || project.trashedAt) return jsonError("Төсөл олдсонгүй.", 404);
    // Байгаа ажлын шатыг санамсаргүй "Захиалга" руу буцаахгүй
    if (project.jobStage) return jsonError("Энэ төсөлд ажлын мэдээлэл аль хэдийн бий.", 409);
    if (project.visibility === "REFERENCE") {
      return jsonError("Reference төсөлд ажил нэмэх боломжгүй.", 400);
    }
    const job = await prisma.project.update({
      where: { id: projectId },
      data: { ...jobData, ...(name ? { name } : {}) },
      select: JOB_SELECT,
    });
    return NextResponse.json({ job: serializeJson(job) }, { status: 200 });
  }

  if (!name) return jsonError("Ажлын нэр шаардлагатай.", 400);

  const job = await prisma.project.create({
    data: {
      name,
      visibility: "SHARED",
      inviteCode: generateInviteCode(),
      ...jobData,
      members: { create: { userId: user.id, role: "OWNER" } },
    },
    select: JOB_SELECT,
  });
  return NextResponse.json({ job: serializeJson(job) }, { status: 201 });
});
