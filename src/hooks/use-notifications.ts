"use client";

import { useEffect, useSyncExternalStore } from "react";

// ─── Мэдэгдлийн нэгдсэн төлөв ────────────────────────────────────────────────
// Хонх, "Даалгавар" цэсний тоо, файлын сэтгэгдлийн тоо — бүгд нэг хүсэлтээс.
// Tab харагдаж байх үед 30 секунд тутам, мөн tab руу буцаж ирэхэд шинэчилнэ.

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  url: string;
  fileId: string | null;
  readAt: string | null;
  createdAt: string;
  actor: { nickname: string | null; email: string } | null;
};

type State = {
  notifications: AppNotification[];
  unread: number;
  unreadTasks: number;
  unreadFiles: Record<string, number>;
  loaded: boolean;
};

const POLL_MS = 30_000;
let state: State = { notifications: [], unread: 0, unreadTasks: 0, unreadFiles: {}, loaded: false };
const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;
let subscribers = 0;
let timer: ReturnType<typeof setInterval> | null = null;

function emit(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

export async function refreshNotifications() {
  if (inflight) return inflight;
  inflight = fetch("/api/notifications")
    .then(async (res) => {
      if (!res.ok) return;
      const data = (await res.json()) as Omit<State, "loaded">;
      emit({ ...data, loaded: true });
    })
    .catch(() => {
      // сүлжээ тасарсан — дараагийн удаа дахин оролдоно
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

// Уншсан болгох — дэлгэцийг шууд шинэчилнэ (серверийн хариуг хүлээхгүй)
export async function markNotificationsRead(
  target: { ids: string[] } | { all: true } | { kind: "tasks" } | { fileId: string },
) {
  const now = new Date().toISOString();
  const hit = (n: AppNotification) =>
    !n.readAt &&
    ("all" in target ||
      ("ids" in target && target.ids.includes(n.id)) ||
      ("kind" in target && (n.type === "TASK_ASSIGNED" || n.type === "TASK_DONE")) ||
      ("fileId" in target && n.fileId === target.fileId && n.type.startsWith("COMMENT")));
  const changed = state.notifications.filter(hit).length;
  const unreadFiles = { ...state.unreadFiles };
  if ("all" in target) Object.keys(unreadFiles).forEach((k) => delete unreadFiles[k]);
  if ("fileId" in target) delete unreadFiles[target.fileId];
  emit({
    ...state,
    notifications: state.notifications.map((n) => (hit(n) ? { ...n, readAt: now } : n)),
    unread: "all" in target ? 0 : Math.max(state.unread - changed, 0),
    unreadTasks: "all" in target || "kind" in target ? 0 : state.unreadTasks,
    unreadFiles,
  });
  try {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(target),
    });
  } finally {
    void refreshNotifications();
  }
}

function start() {
  void refreshNotifications();
  timer = setInterval(() => {
    if (document.visibilityState === "visible") void refreshNotifications();
  }, POLL_MS);
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onFocus);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  window.removeEventListener("focus", onFocus);
  document.removeEventListener("visibilitychange", onFocus);
}

function onFocus() {
  if (document.visibilityState === "visible") void refreshNotifications();
}

const serverState: State = { notifications: [], unread: 0, unreadTasks: 0, unreadFiles: {}, loaded: false };

export function useNotifications(): State {
  const snapshot = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => state,
    () => serverState,
  );
  // Хэд хэдэн газар ашигласан ч нэг л давталт ажиллана
  useEffect(() => {
    subscribers += 1;
    if (subscribers === 1) start();
    return () => {
      subscribers -= 1;
      if (subscribers === 0) stop();
    };
  }, []);
  return snapshot;
}
