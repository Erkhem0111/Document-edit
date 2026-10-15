import { jsonError, requireProjectRole, requireUser, serializeJson, withApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { isJobStage, isJobType } from "@/lib/jobs";
import { JOB_SELECT } from "@/lib/jobs-server";
import { NextResponse } from "next/server";

type Params = Promise<{ projectId: string }>;

// PATCH /api/projects/[id]/job { stage?, type?, client?, dueDate? }
// Шат солих, мэдээлэл засах — засварлах эрхтэй хүн бүр (самбар дээр чирэх).
export const PATCH = withApiError(async function PATCH(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { projectId } = await context.params;
  const membership = await requireProjectRole(projectId, user, "EDITOR");
  if (!membership) return jsonError("Ажлыг засах эрхгүй.", 403);

  const current = await prisma.project.findUnique({
    where: { id: projectId },
    select: { jobStage: true, trashedAt: true },
  });
  if (!current || current.trashedAt) return jsonError("Төсөл олдсонгүй.", 404);
  if (!current.jobStage) return jsonError("Энэ төсөлд ажлын мэдээлэл алга.", 400);

  const body = await req.json().catch(() => ({}));
  const stage = isJobStage(body.stage) ? body.stage : undefined;
  const type = isJobType(body.type) ? body.type : undefined;
  const client =
    typeof body.client === "string" ? body.client.trim().slice(0, 160) || null : undefined;
  const dueDate =
    typeof body.dueDate === "string" ? (body.dueDate ? new Date(body.dueDate) : null) : undefined;
  if (dueDate && Number.isNaN(dueDate.getTime())) return jsonError("Хугацааны огноо буруу байна.", 400);

  const job = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(stage !== undefined
        ? {
            jobStage: stage,
            // Хүлээлгэн өгсөн огноо — самбараас хуучирсныг нуухад ашиглана
            jobDeliveredAt:
              stage === "DELIVERED"
                ? current.jobStage === "DELIVERED"
                  ? undefined
                  : new Date()
                : null,
          }
        : {}),
      ...(type !== undefined ? { jobType: type } : {}),
      ...(client !== undefined ? { jobClient: client } : {}),
      ...(dueDate !== undefined ? { jobDueDate: dueDate } : {}),
    },
    select: JOB_SELECT,
  });

  return NextResponse.json({ job: serializeJson(job) });
});

// DELETE — ажлын мэдээллийг арилгана (төсөл, файлууд хэвээр үлдэнэ)
export const DELETE = withApiError(async function DELETE(_req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { projectId } = await context.params;
  const membership = await requireProjectRole(projectId, user, "OWNER");
  if (!membership) return jsonError("Зөвхөн төслийн эзэн ажлын мэдээллийг арилгана.", 403);

  await prisma.project.update({
    where: { id: projectId },
    data: { jobStage: null, jobType: null, jobClient: null, jobDueDate: null, jobDeliveredAt: null },
  });
  return NextResponse.json({ message: "Ажлын мэдээлэл арилгагдлаа." });
});
