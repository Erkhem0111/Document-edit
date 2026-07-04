"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ShieldCheck } from "lucide-react";

type AdminUser = {
  id: string;
  email: string;
  nickname?: string | null;
  role: "ADMIN" | "ENGINEER";
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
};

// Хэрэглэгчийн удирдлага — зөвхөн ADMIN. Эрх солих, идэвхгүй болгох.
export default function AdminUsersPage() {
  const { user: me, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      const data = (await res.json().catch(() => null)) as
        | { users?: AdminUser[]; message?: string }
        | null;
      if (!res.ok) throw new Error(data?.message ?? "Уншиж чадсангүй.");
      setUsers(data?.users ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (me?.role === "ADMIN") void load();
  }, [me?.role, load]);

  async function patch(
    target: AdminUser,
    body: { role?: string; isActive?: boolean },
    successMsg: string,
  ) {
    setBusyId(target.id);
    try {
      const res = await fetch(`/api/users/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as
        | { message?: string }
        | null;
      if (!res.ok) throw new Error(data?.message ?? "Өөрчилж чадсангүй.");
      toast.success(successMsg);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setBusyId(null);
    }
  }

  if (authLoading) {
    return (
      <div className="p-10 text-sm text-muted-foreground">Loading…</div>
    );
  }

  if (me?.role !== "ADMIN") {
    return (
      <div className="p-10">
        <p className="text-muted-foreground">
          Энэ хуудсыг зөвхөн ADMIN эрхтэй хэрэглэгч нээнэ.
        </p>
        <Link href="/dashboard" className="mt-4 inline-block text-teal underline">
          Back to workspace
        </Link>
      </div>
    );
  }

  return (
    <div className="px-10 py-10">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Workspace
      </Link>

      <div className="mt-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-teal">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-4xl text-primary">Хэрэглэгчид</h1>
          <p className="text-sm text-muted-foreground">
            Эрх солих, идэвхгүй болгох. Идэвхгүй хэрэглэгч нэвтэрч чадахгүй.
          </p>
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="grid grid-cols-[1fr_150px_130px_110px] border-b border-border bg-muted/40 px-5 py-3 text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>Хэрэглэгч</span>
          <span>Сүүлд нэвтэрсэн</span>
          <span>Эрх</span>
          <span>Төлөв</span>
        </div>

        {loading ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : (
          users.map((u) => {
            const isMe = u.id === me?.id;
            const busy = busyId === u.id;
            return (
              <div
                key={u.id}
                className="grid grid-cols-[1fr_150px_130px_110px] items-center border-b border-border/60 px-5 py-3 text-sm last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">
                    {(u.nickname || u.email).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">
                      {u.nickname || u.email}
                      {isMe && (
                        <span className="ml-2 rounded-full bg-accent px-1.5 py-0.5 text-[9px]">
                          та
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {u.email}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {u.lastLoginAt
                    ? format(new Date(u.lastLoginAt), "MMM d, HH:mm")
                    : "—"}
                </span>
                <span>
                  <Select
                    value={u.role}
                    disabled={isMe || busy}
                    onValueChange={(v) =>
                      void patch(u, { role: v }, `${u.email} → ${v}`)
                    }
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Админ</SelectItem>
                      <SelectItem value="ENGINEER">Инженер</SelectItem>
                    </SelectContent>
                  </Select>
                </span>
                <span>
                  <Button
                    size="sm"
                    variant={u.isActive ? "outline" : "default"}
                    disabled={isMe || busy}
                    className={
                      u.isActive
                        ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
                        : "bg-teal text-white"
                    }
                    onClick={() =>
                      void patch(
                        u,
                        { isActive: !u.isActive },
                        u.isActive
                          ? `${u.email} идэвхгүй боллоо`
                          : `${u.email} идэвхжлээ`,
                      )
                    }
                  >
                    {u.isActive ? "Хаах" : "Идэвхжүүлэх"}
                  </Button>
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
