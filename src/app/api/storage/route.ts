import { requireUser, withApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Компанийн нийт хадгалалтын ашиглалт — бүх file version-ийн хэмжээний нийлбэр.
// Quota-г R2_QUOTA_BYTES env-ээс авна, эс бол 50 GB.
const DEFAULT_QUOTA_BYTES = 50 * 1024 * 1024 * 1024;

export const GET = withApiError(async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const aggregate = await prisma.fileVersion.aggregate({
    _sum: { fileSize: true },
  });

  const usedBytes = aggregate._sum.fileSize ?? BigInt(0);
  const quotaBytes = process.env.R2_QUOTA_BYTES
    ? BigInt(process.env.R2_QUOTA_BYTES)
    : BigInt(DEFAULT_QUOTA_BYTES);

  return NextResponse.json({
    usedBytes: usedBytes.toString(),
    quotaBytes: quotaBytes.toString(),
  });
});
