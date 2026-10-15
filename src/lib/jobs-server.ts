import type { Prisma } from "@prisma/client";

// Самбарын карт бүрт хэрэгтэй талбарууд л (файлын жагсаалт, content татахгүй)
export const JOB_SELECT = {
  id: true,
  name: true,
  visibility: true,
  jobStage: true,
  jobType: true,
  jobClient: true,
  jobDueDate: true,
  jobDeliveredAt: true,
  updatedAt: true,
  members: {
    select: {
      role: true,
      user: { select: { id: true, email: true, nickname: true, avatarUrl: true } },
    },
  },
  _count: { select: { files: true } },
} satisfies Prisma.ProjectSelect;
