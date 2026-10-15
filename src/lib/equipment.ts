// ─── Багаж, зөвшөөрөл — оролт шалгах, хугацааны төлөв (client + server) ────────

export type EquipmentKind = "INSTRUMENT" | "PERMIT";

export type EquipmentItem = {
  id: string;
  kind: EquipmentKind;
  name: string;
  serial: string | null;
  holder: string | null;
  validFrom: string | null;
  expiresAt: string | null;
  note: string | null;
};

export const WARN_DAYS = 30;

// Хугацаа дуусахад хэдэн хоног үлдсэн (сөрөг = дууссан), хугацаагүй бол null
export function daysLeft(expiresAt: string | null) {
  if (!expiresAt) return null;
  const today = new Date(new Date().toDateString()).getTime();
  const end = new Date(new Date(expiresAt).toDateString()).getTime();
  return Math.round((end - today) / 86_400_000);
}

export function expiryState(expiresAt: string | null): "ok" | "soon" | "expired" | "none" {
  const d = daysLeft(expiresAt);
  if (d == null) return "none";
  if (d < 0) return "expired";
  if (d <= WARN_DAYS) return "soon";
  return "ok";
}

const text = (v: unknown, max = 200) =>
  typeof v === "string" ? v.trim().slice(0, max) || null : v === null ? null : undefined;

function date(v: unknown): Date | null | undefined | "invalid" {
  if (v === null || v === "") return null;
  if (typeof v !== "string") return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "invalid" : d;
}

// POST (create=true) бол kind, name заавал; PATCH бол өгсөн талбарууд л
export function readEquipmentInput(body: Record<string, unknown>, create: boolean) {
  const kind = body.kind === "INSTRUMENT" || body.kind === "PERMIT" ? body.kind : undefined;
  const name = text(body.name, 160);
  if (create && !kind) return { ok: false, error: "Төрөл (багаж/зөвшөөрөл) шаардлагатай." } as const;
  if ((create || name !== undefined) && !name) return { ok: false, error: "Нэр шаардлагатай." } as const;
  const validFrom = date(body.validFrom);
  const expiresAt = date(body.expiresAt);
  if (validFrom === "invalid" || expiresAt === "invalid") return { ok: false, error: "Огноо буруу байна." } as const;

  const data = {
    ...(kind ? { kind } : {}),
    ...(name ? { name } : {}),
    ...(text(body.serial) !== undefined ? { serial: text(body.serial) } : {}),
    ...(text(body.holder) !== undefined ? { holder: text(body.holder) } : {}),
    ...(text(body.note, 1000) !== undefined ? { note: text(body.note, 1000) } : {}),
    ...(validFrom !== undefined ? { validFrom } : {}),
    ...(expiresAt !== undefined ? { expiresAt } : {}),
  };
  return { ok: true, data: data as typeof data & { kind: EquipmentKind; name: string } } as const;
}
