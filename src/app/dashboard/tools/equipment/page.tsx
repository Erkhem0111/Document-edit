"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import { ChevronRight, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { daysLeft, expiryState, WARN_DAYS, type EquipmentItem, type EquipmentKind } from "@/lib/equipment";

// ─── Багаж, зөвшөөрөл ─────────────────────────────────────────────────────────
// Энгийн хүснэгт: хугацаа дуусах гэж буйг шараар, дууссаныг улаанаар.
// Админ бүртгэж засна, бусад нь харна.

const SECTIONS: Array<{ kind: EquipmentKind; title: string; nameHint: string; serialLabel: string }> = [
  { kind: "PERMIT", title: "Тусгай зөвшөөрөл", nameHint: "Жишээ: Геодези, зураг зүйн тусгай зөвшөөрөл", serialLabel: "Дугаар" },
  { kind: "INSTRUMENT", title: "Багаж (шалгалт тохируулга)", nameHint: "Жишээ: Trimble R12i GNSS", serialLabel: "Серийн дугаар" },
];

export default function EquipmentPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [items, setItems] = useState<EquipmentItem[] | null>(null);
  const [editing, setEditing] = useState<{ kind: EquipmentKind; item?: EquipmentItem } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/equipment");
    const data = (await res.json().catch(() => null)) as { items?: EquipmentItem[]; message?: string } | null;
    if (!res.ok) {
      toast.error(data?.message ?? "Ачаалж чадсангүй.");
      setItems([]);
      return;
    }
    setItems(data?.items ?? []);
  }, []);

  useEffect(() => {
    // fetch-on-mount — setState нь зөвхөн await-ийн дараа
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function remove(item: EquipmentItem) {
    if (!window.confirm(`"${item.name}"-ийг устгах уу?`)) return;
    const res = await fetch(`/api/equipment/${item.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Устгаж чадсангүй.");
      return;
    }
    await load();
  }

  const alerts = (items ?? []).filter((i) => ["soon", "expired"].includes(expiryState(i.expiresAt)));

  return (
    <div className="px-4 py-5 md:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-1.5 font-sans text-lg md:text-xl">
          <Link href="/dashboard/tools" className="text-muted-foreground hover:text-foreground">
            Хэрэгслүүд
          </Link>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          Багаж, зөвшөөрөл
        </h1>
        <p className="text-xs text-muted-foreground">
          Хугацаа дуусахаас {WARN_DAYS} хоногийн өмнө шараар, дууссан бол улаанаар тэмдэглэнэ.
        </p>
      </div>

      {alerts.length > 0 && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-relaxed text-red-900">
          <b>Анхаар:</b> баталгаажуулалтгүй багажаар хэмжилт хийх, хугацаа дууссан зөвшөөрлөөр ажиллах нь
          зөрчилд тооцогдоно. {alerts.map((a) => a.name).join(", ")}.
        </div>
      )}

      {SECTIONS.map((section) => {
        const rows = (items ?? []).filter((i) => i.kind === section.kind);
        return (
          <section key={section.kind} className="mt-6">
            <div className="mb-2 flex items-center">
              <h2 className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {section.title}
              </h2>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setEditing({ kind: section.kind })}
                  className="ml-auto flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" /> Нэмэх
                </button>
              )}
            </div>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {!items ? (
                <div className="space-y-2 p-3">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              ) : rows.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                  Бүртгэл алга.{isAdmin ? " “Нэмэх” дарж бүртгэнэ." : " Админ бүртгэнэ."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-[11px] text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="px-3.5 py-2 text-left font-normal">Нэр</th>
                        <th className="hidden px-3.5 py-2 text-left font-normal sm:table-cell">{section.serialLabel}</th>
                        <th className="hidden px-3.5 py-2 text-left font-normal md:table-cell">Хариуцагч</th>
                        <th className="px-3.5 py-2 text-left font-normal">Хүчинтэй</th>
                        <th className="px-3.5 py-2 text-right font-normal">Төлөв</th>
                        {isAdmin && <th className="w-16" />}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((item) => (
                        <tr key={item.id} className="border-b border-border/60 last:border-0">
                          <td className="px-3.5 py-2">
                            <div className="text-foreground">{item.name}</div>
                            {item.note && <div className="text-xs text-muted-foreground">{item.note}</div>}
                          </td>
                          <td className="hidden px-3.5 py-2 text-xs text-muted-foreground sm:table-cell">{item.serial ?? "—"}</td>
                          <td className="hidden px-3.5 py-2 text-xs text-muted-foreground md:table-cell">{item.holder ?? "—"}</td>
                          <td className="whitespace-nowrap px-3.5 py-2 text-xs tabular-nums text-muted-foreground">
                            {item.expiresAt ? `${format(new Date(item.expiresAt), "yyyy.MM.dd")} хүртэл` : "—"}
                          </td>
                          <td className="px-3.5 py-2 text-right">
                            <StateBadge expiresAt={item.expiresAt} />
                          </td>
                          {isAdmin && (
                            <td className="whitespace-nowrap px-2 py-2 text-right">
                              <button
                                type="button"
                                title="Засах"
                                onClick={() => setEditing({ kind: item.kind, item })}
                                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                title="Устгах"
                                onClick={() => void remove(item)}
                                className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        );
      })}

      {editing && (
        <EquipmentDialog
          key={editing.item?.id ?? editing.kind}
          kind={editing.kind}
          item={editing.item}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function StateBadge({ expiresAt }: { expiresAt: string | null }) {
  const state = expiryState(expiresAt);
  const d = daysLeft(expiresAt);
  if (state === "none") return <span className="text-xs text-muted-foreground">—</span>;
  const meta = {
    ok: ["bg-green-100 text-green-800", "Хүчинтэй"],
    soon: ["bg-amber-100 text-amber-800", `${d} хоног үлдсэн`],
    expired: ["bg-red-100 text-red-800", "Дууссан"],
  }[state];
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${meta[0]}`}>{meta[1]}</span>;
}

function toDateInput(v: string | null | undefined) {
  return v ? new Date(v).toISOString().slice(0, 10) : "";
}

function EquipmentDialog({
  kind,
  item,
  onClose,
  onSaved,
}: {
  kind: EquipmentKind;
  item?: EquipmentItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const section = SECTIONS.find((s) => s.kind === kind)!;
  const [form, setForm] = useState({
    name: item?.name ?? "",
    serial: item?.serial ?? "",
    holder: item?.holder ?? "",
    validFrom: toDateInput(item?.validFrom),
    expiresAt: toDateInput(item?.expiresAt),
    note: item?.note ?? "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    if (!form.name.trim()) {
      toast.error("Нэрээ бичнэ үү.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(item ? `/api/equipment/${item.id}` : "/api/equipment", {
        method: item ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, kind }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Хадгалж чадсангүй.");
      }
      toast.success("Хадгалагдлаа");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Хадгалж чадсангүй.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-sans text-lg">{section.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="eq-name">Нэр</Label>
            <Input id="eq-name" autoFocus value={form.name} onChange={set("name")} placeholder={section.nameHint} className="mt-1.5" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="eq-serial">{section.serialLabel}</Label>
              <Input id="eq-serial" value={form.serial} onChange={set("serial")} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="eq-holder">Хариуцагч</Label>
              <Input id="eq-holder" value={form.holder} onChange={set("holder")} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="eq-from">Эхэлсэн</Label>
              <Input id="eq-from" type="date" value={form.validFrom} onChange={set("validFrom")} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="eq-to">Дуусах</Label>
              <Input id="eq-to" type="date" value={form.expiresAt} onChange={set("expiresAt")} className="mt-1.5" />
            </div>
          </div>
          <div>
            <Label htmlFor="eq-note">Тэмдэглэл</Label>
            <Input id="eq-note" value={form.note} onChange={set("note")} placeholder="Жишээ: Шалгалт тохируулгыг ... хийсэн" className="mt-1.5" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Болих
          </Button>
          <Button className="bg-primary text-primary-foreground" disabled={busy} onClick={() => void save()}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Хадгалах
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
