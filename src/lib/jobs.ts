// ─── Ажлын самбар — шат, төрлийн тогтмолууд (client + server хоёуланд) ─────────
// "Ажил" нь тусдаа зүйл биш — төсөл дээрх нэмэлт мэдээлэл (jobStage != null).

export const JOB_STAGES = ["ORDER", "FIELD", "PROCESSING", "REVIEW", "DELIVERED"] as const;
export type JobStage = (typeof JOB_STAGES)[number];

export const JOB_TYPES = ["CADASTRE", "TOPOGRAPHIC", "ENGINEERING", "OTHER"] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STAGE_LABELS: Record<JobStage, string> = {
  ORDER: "Захиалга",
  FIELD: "Хээрийн хэмжилт",
  PROCESSING: "Боловсруулалт",
  REVIEW: "Хяналт",
  DELIVERED: "Хүлээлгэн өгсөн",
};

// Төслийн нимгэн мөрөнд багтах богино нэр
export const JOB_STAGE_SHORT: Record<JobStage, string> = {
  ORDER: "Захиалга",
  FIELD: "Хээр",
  PROCESSING: "Боловсруулалт",
  REVIEW: "Хяналт",
  DELIVERED: "Хүлээлгэн өгсөн",
};

export const JOB_TYPE_META: Record<JobType, { label: string; className: string }> = {
  CADASTRE: { label: "Кадастр", className: "bg-blue-100 text-blue-700" },
  TOPOGRAPHIC: { label: "Байр зүй", className: "bg-amber-100 text-amber-700" },
  ENGINEERING: { label: "Инженерийн", className: "bg-violet-100 text-violet-700" },
  OTHER: { label: "Бусад", className: "bg-stone-200 text-stone-700" },
};

export function isJobStage(value: unknown): value is JobStage {
  return typeof value === "string" && (JOB_STAGES as readonly string[]).includes(value);
}

export function isJobType(value: unknown): value is JobType {
  return typeof value === "string" && (JOB_TYPES as readonly string[]).includes(value);
}

// Хугацаа хэтэрсэн эсэх (хүлээлгэн өгсөн ажил хэзээ ч хоцрохгүй)
export function overdueDays(job: { jobStage?: string | null; jobDueDate?: string | null }) {
  if (!job.jobDueDate || job.jobStage === "DELIVERED") return 0;
  const today = new Date(new Date().toDateString()).getTime();
  const due = new Date(new Date(job.jobDueDate).toDateString()).getTime();
  return due < today ? Math.round((today - due) / 86_400_000) : 0;
}
