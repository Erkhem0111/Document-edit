"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import { mn } from "date-fns/locale";
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  ClipboardList,
  KeyRound,
  MessageSquare,
  Reply,
  ShieldCheck,
  UserCheck,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import {
  markNotificationsRead,
  useNotifications,
  type AppNotification,
} from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";

// ─── Мэдэгдлийн хонх ─────────────────────────────────────────────────────────
// Уншаагүй мэдэгдэл байвал улаан тоо. Дарахад жагсаалт нээгдэж, мэдэгдэл бүрийг
// нэг дарахад тухайн төсөл, файл, даалгавар руу шууд орно.

const ICONS: Record<string, { icon: LucideIcon; color: string }> = {
  PROJECT_INVITE: { icon: UserPlus, color: "text-teal bg-teal/10" },
  TASK_ASSIGNED: { icon: ClipboardList, color: "text-amber-700 bg-amber-100" },
  TASK_DONE: { icon: CheckCircle2, color: "text-green-700 bg-green-100" },
  COMMENT: { icon: MessageSquare, color: "text-blue-700 bg-blue-100" },
  COMMENT_REPLY: { icon: Reply, color: "text-blue-700 bg-blue-100" },
  ACCESS_REQUEST: { icon: KeyRound, color: "text-violet-700 bg-violet-100" },
  USER_PENDING: { icon: ShieldCheck, color: "text-violet-700 bg-violet-100" },
  USER_APPROVED: { icon: UserCheck, color: "text-green-700 bg-green-100" },
};

function timeAgo(value: string) {
  return formatDistanceToNowStrict(new Date(value), { addSuffix: true, locale: mn });
}

export function NotificationBell() {
  const { notifications, unread } = useNotifications();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function openItem(n: AppNotification) {
    setOpen(false);
    if (!n.readAt) void markNotificationsRead({ ids: [n.id] });
    router.push(n.url);
  }

  return (
    <div ref={boxRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread ? `Мэдэгдэл — ${unread} шинэ` : "Мэдэгдэл"}
        aria-expanded={open}
        title="Мэдэгдэл"
        data-tour="notifications"
        className="relative grid size-9 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Bell className="size-[19px]" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-background">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Мэдэгдэл"
          className="fixed inset-x-3 top-14 z-50 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-[380px]"
        >
          <div className="flex items-center border-b border-border/70 px-4 py-3">
            <h2 className="font-sans text-sm font-semibold text-foreground">Мэдэгдэл</h2>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void markNotificationsRead({ all: true })}
                className="ml-auto flex cursor-pointer items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <CheckCheck className="size-3.5" /> Бүгдийг уншсан
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <Bell className="mx-auto size-8 text-muted-foreground/40" strokeWidth={1.5} />
              <p className="mt-3 text-sm text-foreground">Шинэ мэдэгдэл алга</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Таныг төсөлд нэмэх, даалгавар оноох, сэтгэгдэл бичих үед энд гарна.
              </p>
            </div>
          ) : (
            <ul className="max-h-[min(70vh,480px)] overflow-y-auto py-1">
              {notifications.map((n) => {
                const meta = ICONS[n.type] ?? ICONS.COMMENT;
                const Icon = meta.icon;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openItem(n)}
                      className={cn(
                        "flex w-full cursor-pointer items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent/60",
                        !n.readAt && "bg-teal/[0.04]",
                      )}
                    >
                      <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full", meta.color)}>
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-[13px] leading-snug", n.readAt ? "text-muted-foreground" : "font-medium text-foreground")}>
                          {n.title}
                        </span>
                        {n.body && (
                          <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{n.body}</span>
                        )}
                        <span className="mt-1 block text-[11px] text-muted-foreground/80">{timeAgo(n.createdAt)}</span>
                      </span>
                      {!n.readAt && <span className="mt-2 size-2 shrink-0 rounded-full bg-teal" aria-label="Шинэ" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
