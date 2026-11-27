"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { buildTour, type TourId } from "./tours";
import { findVisible, resolveSteps, TourOverlay, type ResolvedStep } from "./tour-overlay";

// ─── Хэзээ, аль танилцуулгыг харуулах ────────────────────────────────────────
// • Нүүр, төсөл, баримтыг АНХ нээхэд — тухайн хуудасны танилцуулга нэг удаа.
// • "Дахиж бүү харуул" чагттай дуусгавал/алгасвал дахиж гарахгүй (энэ төхөөрөмж
//   дээр). Чагтаа авбал дараагийн удаа нэвтрэхэд дахин гарна.
// • Профайлаас "Танилцуулгыг дахин үзэх" — хүссэн үедээ.
// • Хуудас бүрэн ачаалж, гэрэлтүүлэх хэсэг нь гарч ирсний дараа л эхэлнэ;
//   өөр цонх (dialog) нээлттэй үед хүлээнэ.

const TOUR_EVENT = "tls:tour";
const VERSION = "v1";

export const TOUR_START_EVENT = TOUR_EVENT;

export function startTour(id: TourId) {
  window.dispatchEvent(new CustomEvent<{ id: TourId }>(TOUR_EVENT, { detail: { id } }));
}

// Хуудас бүрийн "бэлэн боллоо" гэж үзэх элемент
const ANCHOR: Record<TourId, string> = { home: "recent", project: "file-list", document: "doc-toolbar" };

function tourForPath(pathname: string): TourId | null {
  if (pathname === "/dashboard") return "home";
  if (pathname === "/dashboard/project") return "project";
  if (pathname === "/dashboard/file") return "document";
  return null;
}

function storageKey(id: TourId, userId: string) {
  return `tls-tour:${VERSION}:${id}:${userId}`;
}

function read(store: "local" | "session", key: string) {
  try {
    return (store === "local" ? window.localStorage : window.sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

function write(store: "local" | "session", key: string, value: string) {
  try {
    (store === "local" ? window.localStorage : window.sessionStorage).setItem(key, value);
  } catch {
    // хувийн цонх г.м. — энэ удаад л санахгүй
  }
}

// Автомат тест (Playwright г.м.) дээр өөрөө гарахгүй — товчийг хаадаг.
// Танилцуулгыг өөрийг нь шалгахдаа localStorage-д tls-tour:force=1 тавина.
function autoStartAllowed() {
  if (typeof navigator === "undefined") return false;
  return !navigator.webdriver || read("local", "tls-tour:force") === "1";
}

// Өөр цонх эсвэл утасны хажуугийн цэс нээлттэй үед эхлэхгүй — гэрэлтүүлэх
// товч нь тэдгээрийн доор нуугдаж, тайлбар буруу газар заана.
function otherDialogOpen() {
  return Boolean(
    document.querySelector('[role="dialog"]:not([data-tour-card]), [data-mobile-drawer]'),
  );
}

function subscribePhone(onChange: () => void) {
  const mq = window.matchMedia("(max-width: 767px)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function TourLauncher({
  user,
}: {
  user: { id: string; name?: string | null; role?: string; approved?: boolean };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isPhone = useSyncExternalStore(
    subscribePhone,
    () => window.matchMedia("(max-width: 767px)").matches,
    () => false,
  );
  const [active, setActive] = useState<{ id: TourId; steps: ResolvedStep[] } | null>(null);
  // "Дахин үзэх" дарсан танилцуулга (хуудас бэлэн болмогц эхэлнэ)
  const [requested, setRequested] = useState<TourId | null>(null);

  const makeSteps = useCallback(
    (id: TourId) =>
      resolveSteps(
        buildTour(id, {
          firstName: (user.name ?? "").trim().split(/\s+/)[0] ?? "",
          isAdmin: user.role === "ADMIN",
          isPending: user.approved === false,
        }),
        isPhone,
      ),
    [user.name, user.role, user.approved, isPhone],
  );

  // Хуудас солигдох бүрт: энэ хуудасны танилцуулгыг (шаардлагатай бол) бэлдэнэ
  useEffect(() => {
    if (active) return;
    const forced = requested;
    const id = forced ?? tourForPath(pathname);
    if (!id || (forced && tourForPath(pathname) !== forced)) return;
    if (!forced) {
      if (!autoStartAllowed()) return;
      if (read("local", storageKey(id, user.id)) === "done") return;
      if (read("session", `tls-tour-seen:${id}`) === "1") return;
    }

    let cancelled = false;
    let waited = 0;
    const timer = setInterval(() => {
      waited += 300;
      if (cancelled) return;
      if (waited > 20_000) return clearInterval(timer);
      if (!findVisible(ANCHOR[id]) || otherDialogOpen()) return;
      clearInterval(timer);
      // Хуудас тогтож дуусахыг бага зэрэг хүлээнэ (зураг, жагсаалт)
      setTimeout(() => {
        if (cancelled || otherDialogOpen()) return;
        setRequested(null);
        const steps = makeSteps(id);
        if (steps.length > 0) setActive({ id, steps });
      }, 450);
    }, 300);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pathname, active, requested, user.id, makeSteps]);

  // "Танилцуулгыг дахин үзэх" — хуудас, цэсний төлөв бэлэн болмогц дээрх effect эхлүүлнэ
  useEffect(() => {
    const onStart = (event: Event) => {
      const id = (event as CustomEvent<{ id: TourId }>).detail?.id;
      if (!id) return;
      setActive(null);
      setRequested(id);
      if (id === "home" && pathname !== "/dashboard") router.push("/dashboard");
    };
    window.addEventListener(TOUR_EVENT, onStart);
    return () => window.removeEventListener(TOUR_EVENT, onStart);
  }, [pathname, router]);

  if (!active) return null;
  return (
    <TourOverlay
      key={active.id}
      steps={active.steps}
      onClose={({ dontShowAgain }) => {
        if (dontShowAgain) write("local", storageKey(active.id, user.id), "done");
        write("session", `tls-tour-seen:${active.id}`, "1");
        setActive(null);
      }}
    />
  );
}
