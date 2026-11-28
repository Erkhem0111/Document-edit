"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { TourStep } from "./tours";

// ─── Тоглоомын маягийн танилцуулга ───────────────────────────────────────────
// Дэлгэцийг бараан болгож, тухайн элементийг л "гэрэлтүүлнэ" (spotlight).
// Хажууд нь тайлбарын карт. Гэрэл алхам бүрт зөөлөн шилжинэ.
// Танилцуулгын үеэр бусад товч дарагдахгүй (санамсаргүй үйлдлээс сэргийлнэ).

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 8; // гэрэлтүүлгийн ирмэгийн зай
const GAP = 14; // гэрэл ба картын зай
const EDGE = 12; // дэлгэцийн захаас хамгийн бага зай

// Дэлгэцэнд харагдаж буй эхний элемент (sidebar утсан дээр хоёр хувь байдаг)
export function findVisible(name: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`);
  for (const node of nodes) {
    const r = node.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && getComputedStyle(node).visibility !== "hidden") return node;
  }
  return null;
}

function sameRect(a: Rect | null, b: Rect | null) {
  if (!a || !b) return a === b;
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

export type ResolvedStep = { target: string | null; title: string; body: string };

export function resolveSteps(steps: TourStep[], isPhone: boolean): ResolvedStep[] {
  const out: ResolvedStep[] = [];
  for (const step of steps) {
    if (isPhone && step.mobile?.skip) continue;
    const target = (isPhone ? (step.mobile?.target ?? step.target) : step.target) ?? null;
    const body = (isPhone ? step.mobile?.body : undefined) ?? step.body;
    out.push({ target, title: step.title, body });
  }
  return out;
}

export function TourOverlay({
  steps,
  onClose,
}: {
  steps: ResolvedStep[];
  // completed — сүүлийн алхам хүртэл үзсэн; dontShowAgain — чагт
  onClose: (result: { completed: boolean; dontShowAgain: boolean }) => void;
}) {
  // Дэлгэцэнд элемент нь байхгүй алхмыг (эрх, утас г.м.) эхэнд нь хасна
  const [live] = useState(() => steps.filter((s) => !s.target || findVisible(s.target)));
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardSize, setCardSize] = useState({ width: 340, height: 180 });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [dontShowAgain, setDontShowAgain] = useState(true);
  // Гэрэл зөвхөн алхам солигдох үед гулсаж шилжинэ. Бусад үед (хуудас scroll
  // хийх, хэмжээ өөрчлөгдөх) элементэд шууд наалдана — хоцорч "зөрөхгүй".
  const [gliding, setGliding] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const step = live[index];
  const last = index === live.length - 1;

  const close = useCallback(
    (completed: boolean) => onClose({ completed, dontShowAgain }),
    [onClose, dontShowAgain],
  );

  // Гэрэлтүүлэх элементийн байрлалыг frame бүрт дагана (scroll, resize, анимэйшн)
  useEffect(() => {
    if (!step) return;
    const el = step.target ? findVisible(step.target) : null;
    if (el) {
      const r = el.getBoundingClientRect();
      const fullyVisible = r.top >= 0 && r.bottom <= window.innerHeight;
      // Дэлгэцийн талаас өндөр хэсгийг (утсан дээрх урт жагсаалт) дээд хэсгээр нь
      // харуулна — доор нь картад зай үлдэнэ. Шууд (smooth биш) — гэрэл хоцрохгүй.
      const tall = r.height > window.innerHeight * 0.45;
      if (tall && (r.top < 0 || r.top > window.innerHeight * 0.25)) {
        el.scrollIntoView({ block: "start", behavior: "auto" });
      } else if (!tall && !fullyVisible) {
        el.scrollIntoView({ block: "center", behavior: "auto" });
      }
    }
    const glideOn = setTimeout(() => setGliding(true), 0);
    const glideOff = setTimeout(() => setGliding(false), 420);
    let frame = 0;
    let prev: Rect | null | undefined;
    const tick = () => {
      const node = step.target ? findVisible(step.target) : null;
      const r = node?.getBoundingClientRect();
      const next = r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
      if (prev === undefined || !sameRect(prev, next)) {
        prev = next;
        setRect(next);
      }
      setViewport((v) =>
        v.width === window.innerWidth && v.height === window.innerHeight
          ? v
          : { width: window.innerWidth, height: window.innerHeight },
      );
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(glideOn);
      clearTimeout(glideOff);
    };
  }, [step]);

  // Картын бодит хэмжээ (байрлал тооцоход)
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setCardSize((s) => (Math.abs(s.width - width) < 1 && Math.abs(s.height - height) < 1 ? s : { width, height }));
  }, [index, viewport.width]);

  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true });
  }, [index]);

  const go = useCallback(
    (delta: number) => {
      if (delta > 0 && last) return close(true);
      setIndex((i) => Math.min(Math.max(i + delta, 0), live.length - 1));
    },
    [last, close, live.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(false);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, go]);

  if (!step || viewport.width === 0) {
    // Эхний frame-ийн дараа хэмжээ мэдэгдэнэ
    if (!step) return null;
  }

  const vw = viewport.width || (typeof window !== "undefined" ? window.innerWidth : 1024);
  const vh = viewport.height || (typeof window !== "undefined" ? window.innerHeight : 768);
  let spot = rect
    ? {
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  // Картыг гэрлийн доор → дээр → баруун → зүүн, багтах газарт байрлуулна
  let cardTop: number;
  let cardLeft: number;
  let arrow: { side: "top" | "bottom" | "left" | "right"; offset: number } | null = null;
  const cw = Math.min(cardSize.width, vw - EDGE * 2);
  const ch = cardSize.height;
  if (!spot) {
    cardTop = (vh - ch) / 2;
    cardLeft = (vw - cw) / 2;
  } else {
    const below = vh - (spot.top + spot.height) - GAP;
    const above = spot.top - GAP;
    const right = vw - (spot.left + spot.width) - GAP;
    const centerX = spot.left + spot.width / 2;
    const centerY = spot.top + spot.height / 2;
    const clampX = (x: number) => Math.min(Math.max(x, EDGE), vw - cw - EDGE);
    const clampY = (y: number) => Math.min(Math.max(y, EDGE), vh - ch - EDGE);
    if (below >= ch) {
      cardTop = spot.top + spot.height + GAP;
      cardLeft = clampX(centerX - cw / 2);
      arrow = { side: "top", offset: centerX - cardLeft };
    } else if (above >= ch) {
      cardTop = spot.top - GAP - ch;
      cardLeft = clampX(centerX - cw / 2);
      arrow = { side: "bottom", offset: centerX - cardLeft };
    } else if (right >= cw) {
      cardLeft = spot.left + spot.width + GAP;
      cardTop = clampY(centerY - ch / 2);
      arrow = { side: "left", offset: centerY - cardTop };
    } else if (spot.left - GAP >= cw) {
      cardLeft = spot.left - GAP - cw;
      cardTop = clampY(centerY - ch / 2);
      arrow = { side: "right", offset: centerY - cardTop };
    } else {
      // Багтахгүй өндөр хэсэг — гэрлийг дээд (харагдаж буй) хэсгээр нь хязгаарлаж,
      // картыг доор нь тавина. Хэт бага зай үлдвэл дэлгэцийн доод талд.
      const maxHeight = vh - ch - GAP - EDGE - spot.top;
      if (maxHeight >= 64) {
        spot = { ...spot, height: maxHeight };
        cardTop = spot.top + maxHeight + GAP;
        cardLeft = clampX(centerX - cw / 2);
        arrow = { side: "top", offset: centerX - cardLeft };
      } else {
        cardTop = vh - ch - EDGE;
        cardLeft = (vw - cw) / 2;
      }
    }
    if (arrow) {
      const limit = arrow.side === "top" || arrow.side === "bottom" ? cw : ch;
      arrow.offset = Math.min(Math.max(arrow.offset, 22), limit - 22);
    }
  }

  const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
  const overlay = (
    <div className="fixed inset-0 z-[200]" role="presentation" data-tour-overlay>
      {/* Бусад товчийг дарагдахаас хамгаална */}
      <div className="absolute inset-0" />
      {/* Гэрэл: тойрсон бүх хэсгийг бараан сүүдрээр бүрхэнэ */}
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-xl"
        style={{
          top: spot ? spot.top : vh / 2,
          left: spot ? spot.left : vw / 2,
          width: spot ? spot.width : 0,
          height: spot ? spot.height : 0,
          boxShadow: "0 0 0 9999px rgba(9, 20, 24, 0.68)",
          transition: gliding
            ? `top 380ms ${ease}, left 380ms ${ease}, width 380ms ${ease}, height 380ms ${ease}`
            : "none",
        }}
      >
        {spot && (
          <span className="absolute inset-0 rounded-xl ring-2 ring-white/90 motion-safe:animate-[tour-pulse_1.8s_ease-out_infinite]" />
        )}
      </div>

      {/* Тайлбарын карт */}
      <div
        ref={cardRef}
        role="dialog"
        data-tour-card
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className="absolute w-[min(340px,calc(100vw-24px))] rounded-2xl bg-card p-4 text-card-foreground shadow-2xl ring-1 ring-black/5"
        style={{
          top: cardTop,
          left: cardLeft,
          transition: gliding ? `top 380ms ${ease}, left 380ms ${ease}` : "none",
        }}
      >
        {arrow && (
          <span
            aria-hidden
            className="absolute size-3 rotate-45 bg-card"
            style={
              arrow.side === "top"
                ? { top: -6, left: arrow.offset - 6 }
                : arrow.side === "bottom"
                  ? { bottom: -6, left: arrow.offset - 6 }
                  : arrow.side === "left"
                    ? { left: -6, top: arrow.offset - 6 }
                    : { right: -6, top: arrow.offset - 6 }
            }
          />
        )}
        <div key={index} className="relative motion-safe:animate-[tour-in_260ms_ease-out]">
          <div className="mb-1 text-[11px] font-medium tabular-nums text-teal">
            {index + 1} / {live.length}
          </div>
          <h2 id="tour-title" className="font-sans text-base font-semibold leading-snug text-foreground">
            {step.title}
          </h2>
          <p id="tour-body" className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {step.body}
          </p>
        </div>

        {/* Алхмын цэгүүд + шилжих товчнууд */}
        <div className="relative mt-4 flex items-center gap-2">
          <div className="mr-auto flex items-center gap-1.5" aria-hidden>
            {live.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === index ? "w-5 bg-teal" : i < index ? "w-1.5 bg-teal/50" : "w-1.5 bg-border"
                }`}
              />
            ))}
          </div>
          {index > 0 && (
            <button
              type="button"
              onClick={() => go(-1)}
              className="cursor-pointer rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              Өмнөх
            </button>
          )}
          <button
            ref={nextRef}
            type="button"
            onClick={() => go(1)}
            className="cursor-pointer rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/50"
          >
            {last ? "Ойлголоо" : index === 0 && !step.target ? "Эхлэх" : "Дараах"}
          </button>
        </div>

        {/* Дахиж харуулах эсэх + алгасах */}
        <div className="relative mt-3 flex items-center border-t border-border/60 pt-2.5">
          <label className="mr-auto flex cursor-pointer select-none items-center gap-1.5 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="size-3.5 cursor-pointer accent-teal"
            />
            Дахиж бүү харуул
          </label>
          {!last && (
            <button
              type="button"
              onClick={() => close(false)}
              className="cursor-pointer rounded-full px-2 py-1 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Алгасах
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
