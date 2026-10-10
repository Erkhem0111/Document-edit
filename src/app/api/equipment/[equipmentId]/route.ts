import { jsonError, requireUser, serializeJson, withApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { readEquipmentInput } from "@/lib/equipment";
import { NextResponse } from "next/server";

type Params = Promise<{ equipmentId: string }>;

export const PATCH = withApiError(async function PATCH(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (user.role !== "ADMIN") return jsonError("Зөвхөн админ засна.", 403);

  const { equipmentId } = await context.params;
  const input = readEquipmentInput(await req.json().catch(() => ({})), false);
  if (!input.ok) return jsonError(input.error, 400);

  const exists = await prisma.equipment.findUnique({ where: { id: equipmentId }, select: { id: true } });
  if (!exists) return jsonError("Олдсонгүй.", 404);

  const item = await prisma.equipment.update({ where: { id: equipmentId }, data: input.data });
  return NextResponse.json({ item: serializeJson(item) });
});

export const DELETE = withApiError(async function DELETE(_req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (user.role !== "ADMIN") return jsonError("Зөвхөн админ устгана.", 403);

  const { equipmentId } = await context.params;
  await prisma.equipment.deleteMany({ where: { id: equipmentId } });
  return NextResponse.json({ message: "Устгагдлаа." });
});
