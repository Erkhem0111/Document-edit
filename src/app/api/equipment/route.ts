import { jsonError, requireUser, serializeJson, withApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { readEquipmentInput } from "@/lib/equipment";
import { NextResponse } from "next/server";

// GET /api/equipment — бүх хэрэглэгч харна (хугацаа дуусах дарааллаар)
export const GET = withApiError(async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const items = await prisma.equipment.findMany({
    orderBy: [{ expiresAt: { sort: "asc", nulls: "last" } }, { name: "asc" }],
    take: 500,
  });
  return NextResponse.json({ items: serializeJson(items) });
});

// POST /api/equipment — зөвхөн админ бүртгэнэ
export const POST = withApiError(async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (user.role !== "ADMIN") return jsonError("Зөвхөн админ бүртгэнэ.", 403);

  const input = readEquipmentInput(await req.json().catch(() => ({})), true);
  if (!input.ok) return jsonError(input.error, 400);

  const item = await prisma.equipment.create({ data: input.data });
  return NextResponse.json({ item: serializeJson(item) }, { status: 201 });
});
