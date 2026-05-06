import { jsonError, requireUser, serializeJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const where =
    user.role === "ADMIN"
      ? { isArchived: false }
      : {
          isArchived: false,
          members: {
            some: {
              userId: user.id,
            },
          },
        };

  const projects = await prisma.project.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: {
          files: true,
          tasks: true,
          members: true,
        },
      },
      members: {
        where: { userId: user.id },
        select: { role: true },
      },
    },
  });

  return NextResponse.json({ projects: serializeJson(projects) });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : null;

  if (!name) return jsonError("Төслийн нэр шаардлагатай.", 400);

  const project = await prisma.project.create({
    data: {
      name,
      description,
      members: {
        create: {
          userId: user.id,
          role: "OWNER",
        },
      },
    },
    include: {
      _count: {
        select: {
          files: true,
          tasks: true,
          members: true,
        },
      },
      members: {
        where: { userId: user.id },
        select: { role: true },
      },
    },
  });

  return NextResponse.json({ project: serializeJson(project) }, { status: 201 });
}
