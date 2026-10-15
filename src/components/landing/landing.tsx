"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import {
  ArrowRight,
  Bell,
  BookMarked,
  Bot,
  Building2,
  Check,
  ClipboardList,
  FileText,
  FolderLock,
  History,
  KanbanSquare,
  Lock,
  MapPin,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { TlsLogo } from "@/components/brand/tls-logo";
import { cn } from "@/lib/utils";

// ─── Танилцуулга хуудас ───────────────────────────────────────────────────────
// Хэмжилтийн компанийн өнгө аяс: хар хөх дэвсгэр, газрын зургийн өндрийн
// шугам (contour), алт + ногоон-хөх онцлох өнгө. Scroll хийхэд:
//  1) Hero-ийн 3D апп-ын зураг хэвтээ байдлаасаа босож тэгширнэ
//  2) "Нэг өдрийн ажил" хэсэг наалдаж, алхам бүрээр зураг нь солигдоно
// prefers-reduced-motion асаалттай бол хөдөлгөөнгүйгээр бүгд харагдана.

// ── Өндрийн шугам (детерминист — server/client ижил гарна) ──
function contourPath(cx: number, cy: number, r: number, seed: number) {
  const points = 48;
  const coords: [number, number][] = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const wobble =
      1 +
      0.13 * Math.sin(a * 3 + seed) +
      0.07 * Math.sin(a * 5 + seed * 1.7) +
      0.04 * Math.cos(a * 2 + seed * 0.6);
    coords.push([cx + Math.cos(a) * r * wobble * 1.35, cy + Math.sin(a) * r * wobble]);
  }
  // Catmull-Rom → Bézier, тойрог хэлбэрээр хаана
  let d = `M${coords[0][0].toFixed(1)},${coords[0][1].toFixed(1)}`;
  for (let i = 0; i < points; i++) {
    const p0 = coords[(i - 1 + points) % points];
    const p1 = coords[i];
    const p2 = coords[(i + 1) % points];
    const p3 = coords[(i + 2) % points];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return `${d} Z`;
}

const HILL_A = Array.from({ length: 11 }, (_, i) => contourPath(330, 330, 40 + i * 30, 1.3 + i * 0.35));
const HILL_B = Array.from({ length: 8 }, (_, i) => contourPath(1180, 620, 30 + i * 34, 4.1 + i * 0.4));

function Contours({ y, className }: { y?: MotionValue<number>; className?: string }) {
  return (
    <motion.svg
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
      style={{ y }}
      aria-hidden
    >
      {HILL_A.map((d, i) => (
        <path
          key={`a${i}`}
          d={d}
          fill="none"
          stroke={i % 5 === 4 ? "var(--gold)" : "var(--teal)"}
          strokeOpacity={i % 5 === 4 ? 0.5 : 0.35}
          strokeWidth={i % 5 === 4 ? 1.4 : 0.9}
        />
      ))}
      {HILL_B.map((d, i) => (
        <path
          key={`b${i}`}
          d={d}
          fill="none"
          stroke={i % 4 === 3 ? "var(--gold)" : "var(--teal)"}
          strokeOpacity={i % 4 === 3 ? 0.45 : 0.3}
          strokeWidth={i % 4 === 3 ? 1.3 : 0.8}
        />
      ))}
    </motion.svg>
  );
}

// ── Хэмжилтийн цэг (parallax-аар хөвнө) ──
function SurveyPoint({
  label,
  coords,
  className,
  y,
}: {
  label: string;
  coords: string;
  className: string;
  y: MotionValue<number>;
}) {
  return (
    <motion.div style={{ y }} className={cn("pointer-events-none absolute hidden md:block", className)}>
      <div className="flex items-center gap-2">
        <span className="relative grid h-4 w-4 place-items-center">
          <span className="absolute h-4 w-4 animate-ping rounded-full bg-gold/30" />
          <span className="h-2 w-2 rotate-45 bg-gold" />
        </span>
        <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10px] leading-tight text-white/70 backdrop-blur">
          <span className="block text-gold">{label}</span>
          {coords}
        </span>
      </div>
    </motion.div>
  );
}

const NAV = [
  ["#workflow", "Хэрхэн ажилладаг"],
  ["#structure", "Бүтэц"],
  ["#tools", "Хэрэгслүүд"],
  ["#security", "Аюулгүй байдал"],
] as const;

export function Landing() {
  const reduce = useReducedMotion();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const [solidNav, setSolidNav] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => setSolidNav(v > 40));

  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const smooth = useSpring(heroProgress, { stiffness: 120, damping: 30, mass: 0.4 });
  const tilt = useTransform(smooth, [0, 0.45], [reduce ? 0 : 32, 0]);
  const mockScale = useTransform(smooth, [0, 0.45], [reduce ? 1 : 0.88, 1]);
  const mockY = useTransform(smooth, [0, 0.45], [reduce ? 0 : 40, 0]);
  const contourY = useTransform(heroProgress, [0, 1], [0, reduce ? 0 : 220]);
  const pointY1 = useTransform(heroProgress, [0, 1], [0, reduce ? 0 : -160]);
  const pointY2 = useTransform(heroProgress, [0, 1], [0, reduce ? 0 : -300]);
  const pointY3 = useTransform(heroProgress, [0, 1], [0, reduce ? 0 : -90]);

  return (
    <main className="min-h-screen overflow-x-clip bg-background text-foreground">
      {/* ── Навигаци ── */}
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-all duration-300",
          solidNav ? "border-b border-white/10 bg-sidebar/85 backdrop-blur-xl" : "bg-transparent",
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="Terra Line" className="text-white [&_*]:text-white">
            <TlsLogo size="sm" showText inverted />
          </Link>
          <nav className="hidden items-center gap-7 text-sm md:flex">
            {NAV.map(([href, label]) => (
              <a key={href} href={href} className="text-white/65 transition hover:text-white">
                {label}
              </a>
            ))}
          </nav>
          <Link
            href="/login"
            className="flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-gold-foreground transition hover:brightness-105"
          >
            Нэвтрэх <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section ref={heroRef} className="relative overflow-hidden bg-sidebar pb-24 pt-32 text-white sm:pt-40">
        <Contours y={contourY} className="opacity-70" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_20%,var(--sidebar)_75%)]" />

        <SurveyPoint label="TP-07" coords="N 5 312 488.21 · E 652 104.66" className="left-[6%] top-[30%]" y={pointY1} />
        <SurveyPoint label="GNSS-2" coords="N 5 309 902.75 · E 655 871.03" className="right-[7%] top-[22%]" y={pointY2} />
        <SurveyPoint label="BM-14" coords="H 1 312.448 м" className="right-[16%] top-[52%]" y={pointY3} />

        <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6">
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs text-white/75 backdrop-blur"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-gold" />
            Terra Line Survey-ийн дотоод ажлын орчин
          </motion.span>

          <h1 className="mt-7 font-display text-[2.6rem] leading-[1.05] sm:text-6xl lg:text-7xl">
            {["Хээрээс", "тайлан", "хүртэл —"].map((word, i) => (
              <motion.span
                key={word}
                className="mr-[0.25em] inline-block"
                initial={{ opacity: 0, y: 28, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ delay: 0.15 + i * 0.12, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              >
                {word}
              </motion.span>
            ))}
            <br />
            <motion.span
              className="inline-block bg-gradient-to-r from-gold via-[oklch(0.88_0.06_90)] to-teal bg-clip-text italic text-transparent"
              initial={{ opacity: 0, y: 28, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ delay: 0.55, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              бүх ажил нэг дор.
            </motion.span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg"
          >
            Хэмжилтийн файл, тайлан, гэрээ, даалгавар, ажлын явц, багажийн хугацаа — бүгд нэг
            вэб орчинд. Хамт засварлаж, нэг товчоор хуваалцаж, оффис, талбай, гэрээсээ ажиллана.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.95, duration: 0.6 }}
            className="mt-9 flex flex-wrap items-center justify-center gap-3"
          >
            <Link
              href="/login"
              className="group flex items-center gap-2 rounded-full bg-gold px-7 py-3.5 text-sm font-semibold text-gold-foreground shadow-[0_10px_40px_-10px_var(--gold)] transition hover:brightness-105"
            >
              Ажлын орчин руу орох
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#workflow"
              className="rounded-full border border-white/20 px-7 py-3.5 text-sm font-medium text-white/85 transition hover:bg-white/10"
            >
              Хэрхэн ажилладгийг үзэх
            </a>
          </motion.div>
        </div>

        {/* 3D апп — scroll хийхэд босож тэгширнэ */}
        <div className="relative mx-auto mt-16 max-w-6xl px-4 sm:px-6 [perspective:1400px]">
          <motion.div
            style={{ rotateX: tilt, scale: mockScale, y: mockY, transformOrigin: "50% 0%" }}
            className="relative"
          >
            <div className="absolute -inset-x-10 -bottom-10 top-10 rounded-[2rem] bg-teal/30 blur-3xl" />
            <AppMockup />
          </motion.div>
        </div>
      </section>

      <Marquee />
      <Workflow />
      <Structure />
      <Tools />
      <Security />
      <FinalCta />
    </main>
  );
}

// ── Hero дахь апп-ын зураг (бодит интерфейстэй ижил бүтэц) ──
function AppMockup() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-background text-foreground shadow-2xl">
      <div className="flex items-center gap-1.5 border-b border-border bg-muted/60 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
        <span className="mx-auto hidden rounded-md bg-background px-10 py-0.5 text-[11px] text-muted-foreground sm:block">
          workspace.terraline.mn
        </span>
      </div>
      <div className="grid grid-cols-[150px_1fr] text-left sm:grid-cols-[200px_1fr]">
        <aside className="space-y-1 bg-sidebar p-3 text-[11px] text-sidebar-foreground sm:text-xs">
          <div className="mb-3 flex items-center gap-2 rounded-md bg-sidebar-primary px-2.5 py-2 font-semibold text-sidebar-primary-foreground">
            + Шинэ
          </div>
          {[
            [ClipboardList, "Даалгавар"],
            [KanbanSquare, "Хэрэгслүүд"],
          ].map(([Icon, label]) => {
            const I = Icon as LucideIcon;
            return (
              <div key={label as string} className="flex items-center gap-2 px-2 py-1 text-sidebar-foreground/75">
                <I className="h-3.5 w-3.5" /> {label as string}
              </div>
            );
          })}
          <div className="px-2 pb-1 pt-3 text-[9px] uppercase tracking-widest text-sidebar-foreground/45">
            Хадгалах газар
          </div>
          {[
            [FolderLock, "Миний файлууд", "#be123c"],
            [Users, "Төслүүд", "#2563eb"],
            [BookMarked, "Компанийн сан", "#b45309"],
            [Trash2, "Хогийн сав", "#8a817c"],
          ].map(([Icon, label, color]) => {
            const I = Icon as LucideIcon;
            return (
              <div key={label as string}>
                <div className="flex items-center gap-2 px-2 py-1">
                  <I className="h-3.5 w-3.5" style={{ color: color as string }} /> {label as string}
                </div>
                {label === "Төслүүд" && (
                  <div className="ml-4 space-y-1 border-l border-sidebar-border py-0.5 pl-2 text-sidebar-foreground/70">
                    <div className="truncate">Хан-Уул 15-р хороо</div>
                    <div className="truncate rounded bg-sidebar-accent px-1.5 py-0.5 text-sidebar-foreground">
                      Зайсан гүүрийн суурь
                    </div>
                    <div className="truncate">Сонгинохайрхан 1:500</div>
                  </div>
                )}
              </div>
            );
          })}
        </aside>
        <div className="min-w-0 p-4 sm:p-6">
          <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-[11px] text-muted-foreground">
            <Search className="h-3.5 w-3.5" /> Файл, төсөл хайх…
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm font-medium sm:text-base">Зайсан гүүрийн суурь</div>
            <div className="flex -space-x-1.5">
              {["#2563eb", "#0f766e", "#b45309"].map((c, i) => (
                <span key={c} className="grid h-6 w-6 place-items-center rounded-full border-2 border-background text-[9px] font-semibold text-white" style={{ background: c }}>
                  {"БСО"[i]}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-border bg-card px-3 py-2 text-[11px]">
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700">Хээрийн хэмжилт</span>
            <span className="ml-2 text-muted-foreground">Захиалагч: Тэнгэр ХХК · 10/30</span>
          </div>
          <div className="mt-3 divide-y divide-border/70 text-[11px] sm:text-xs">
            {[
              ["Хэмжилтийн тайлан.docx", "Би", "2 мин", "bg-blue-500"],
              ["Цэгийн координат.csv", "Сараа", "1 цаг", "bg-green-500"],
              ["Суурийн зураг.dwg", "Очир", "Өчигдөр", "bg-amber-500"],
              ["Газар өмчлөлийн гэрээ.pdf", "Би", "10/02", "bg-red-500"],
            ].map(([name, who, when, dot]) => (
              <div key={name} className="flex items-center gap-2.5 py-2">
                <span className={cn("h-5 w-4 shrink-0 rounded-sm", dot)} />
                <span className="min-w-0 flex-1 truncate">{name}</span>
                {name.endsWith(".csv") && (
                  <span className="hidden rounded-full bg-green-100 px-2 py-0.5 text-[10px] text-green-800 sm:inline">
                    Зураг дээр харах
                  </span>
                )}
                <span className="hidden w-12 text-muted-foreground sm:block">{who}</span>
                <span className="w-14 text-right text-muted-foreground">{when}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Гүйдэг мөр ──
function Marquee() {
  const reduce = useReducedMotion();
  const items = [
    "Кадастрын хэмжилт",
    "Топографийн зураглал",
    "Барилгын тэнхлэг",
    "Газар өмчлөл",
    "UTM 46–50",
    "MONREF97",
    "GNSS",
    "Тахеометр",
    "Нивелир",
    "Хэмжилтийн тайлан",
  ];
  const row = [...items, ...items];
  return (
    <div className="overflow-hidden border-y border-white/10 bg-sidebar py-4 text-white/60">
      <motion.div
        className="flex w-max gap-10 whitespace-nowrap text-sm"
        animate={reduce ? undefined : { x: ["0%", "-50%"] }}
        transition={{ duration: 38, repeat: Infinity, ease: "linear" }}
      >
        {row.map((item, i) => (
          <span key={i} className="flex items-center gap-10">
            {item}
            <span className="h-1.5 w-1.5 rotate-45 bg-gold/60" />
          </span>
        ))}
      </motion.div>
    </div>
  );
}

// ── "Нэг өдрийн ажил" — наалддаг scroll хэсэг ──
type Step = {
  kicker: string;
  title: string;
  text: string;
  points: string[];
  icon: LucideIcon;
  Visual: () => React.JSX.Element;
};

const STEPS: Step[] = [
  {
    kicker: "01 · Хадгалах",
    title: "Файл бүр өөрийн байрандаа",
    text: "Хувийн ноорог “Миний файлууд”-д, багийн ажил “Төслүүд”-д, загвар журам “Компанийн сан”-д. Хэн юу харахыг байршил нь өөрөө тодорхойлно.",
    points: ["DWG, PDF, Excel, зураг — 50MB хүртэл", "Чирж оруулна, олноор нь сонгож зөөнө", "Хогийн савнаас нэг товчоор сэргээнэ"],
    icon: FolderLock,
    Visual: VisualFolders,
  },
  {
    kicker: "02 · Хамтран засах",
    title: "Тайлангаа зэрэг бичнэ",
    text: "Баримт дээр дарахад Google Docs шиг засварлагч нээгдэнэ. Хэд хэдэн хүн нэг дор бичиж, бие биеийнхээ курсорыг харна. Word, PDF-ээр гаргана.",
    points: ["Автомат хадгалалт, түүх", "Зураг шууд буулгана", "Түгжиж, зөвхөн харах горимд шилжүүлнэ"],
    icon: FileText,
    Visual: VisualEditor,
  },
  {
    kicker: "03 · Хуваалцах",
    title: "Хэнд, ямар эрх — нэг цонхонд",
    text: "Хамт ажиллах хүмүүсээ нэрээр нь хайж нэмнэ. “Засах” эсвэл “Харах” эрх өгөөд, хүсвэл компанийн бүх хүнд нээнэ. Нэмэгдсэн хүнд имэйл очно.",
    points: ["Урих код, линк хэрэггүй", "Эрхийг хүссэн үедээ солино", "Хувийн файл хэзээ ч бусдад харагдахгүй"],
    icon: Users,
    Visual: VisualShare,
  },
  {
    kicker: "04 · Даалгавар",
    title: "Хэн, юуг, хэзээ гэдэг тодорхой",
    text: "Даалгавар үүсгээд хариуцагч, зэрэглэл, хугацааг заана. Нүүр хуудсанд хүн бүр өөрт оноогдсоноо хугацааны дарааллаар харна.",
    points: ["Оноогдоход имэйлээр мэдэгдэнэ", "Хугацаа хэтэрвэл улаанаар тодорно", "Хийх → Хийгдэж буй → Дууссан"],
    icon: ClipboardList,
    Visual: VisualTasks,
  },
  {
    kicker: "05 · Ажлын явц",
    title: "Бүх ажил аль шатандаа явааг нэг самбараас",
    text: "Захиалга, хээрийн хэмжилт, боловсруулалт, хүлээлгэн өгсөн — ажил бүр карт болж, чирэхэд шат нь солигдоно. Хоцорсон ажил шууд анхаарал татна.",
    points: ["Захиалагч, хугацаа, ажлын төрөл", "Ажил бүр төслийн файлуудтайгаа холбоотой", "Удирдлагад нэг дор тойм"],
    icon: KanbanSquare,
    Visual: VisualBoard,
  },
  {
    kicker: "06 · Координат",
    title: "CSV-ээ хиймэл дагуулын зураг дээр",
    text: "Багажнаас гарсан координатын файлыг нээхэд цэгүүд зураг дээр гарч, талбай, периметр тооцогдоно. X/Y солигдсон, алдаатай цэг, огтлолцсон хилийг анхааруулна.",
    points: ["UTM 46–50 · MONREF97", "Гэрчилгээний талбайтай харьцуулна", "Каталогийг Word, KML, DXF-ээр гаргана"],
    icon: MapPin,
    Visual: VisualMap,
  },
  {
    kicker: "07 · Багаж, зөвшөөрөл",
    title: "Баталгаажуулалт хэзээ ч мартагдахгүй",
    text: "Тахеометр, GNSS, нивелирийн баталгаажуулалт, тусгай зөвшөөрлийн хугацааг бүртгэнэ. Дуусахаас 30 хоногийн өмнө анхааруулна.",
    points: ["Гэрчилгээний хуулбартайгаа", "Дууссан, дуусах гэж буйг ялгаж харуулна", "Торгууль, саатлаас сэргийлнэ"],
    icon: Wrench,
    Visual: VisualEquipment,
  },
];

function Workflow() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setActive(Math.min(STEPS.length - 1, Math.max(0, Math.floor(v * STEPS.length))));
  });
  const rail = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  const step = STEPS[active];
  const Icon = step.icon;

  return (
    <section id="workflow" className="relative bg-background">
      <div className="mx-auto max-w-7xl px-4 pt-24 text-center sm:px-6">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-teal">Хэрхэн ажилладаг</p>
        <h2 className="mx-auto mt-3 max-w-3xl font-display text-4xl leading-tight text-primary sm:text-5xl">
          Хэмжилтийн компанийн нэг өдөр, эхнээс нь дуустал
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          Доош гүйлгэхэд алхам бүрийг харуулна.
        </p>
      </div>

      <div ref={ref} style={{ height: `${STEPS.length * 85}vh` }} className="relative">
        <div className="sticky top-0 flex h-[100svh] items-center">
          <div className="mx-auto grid w-full max-w-7xl items-center gap-6 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-14">
            {/* Текст */}
            <div className="order-2 flex gap-5 lg:order-1">
              <div className="relative hidden w-1 shrink-0 overflow-hidden rounded-full bg-border sm:block">
                <motion.div style={{ height: rail }} className="absolute inset-x-0 top-0 rounded-full bg-gradient-to-b from-teal to-gold" />
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -24 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="min-w-0"
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-teal">
                    <Icon className="h-4 w-4" /> {step.kicker}
                  </div>
                  <h3 className="mt-2 font-display text-2xl leading-tight text-primary sm:text-4xl">{step.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">{step.text}</p>
                  <ul className="mt-4 hidden space-y-2 sm:block">
                    {step.points.map((p) => (
                      <li key={p} className="flex gap-2.5 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal" /> {p}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5 flex gap-1.5">
                    {STEPS.map((s, i) => (
                      <span
                        key={s.kicker}
                        className={cn(
                          "h-1.5 rounded-full transition-all",
                          i === active ? "w-6 bg-teal" : "w-1.5 bg-border",
                        )}
                      />
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Зураг */}
            <div className="order-1 lg:order-2 [perspective:1200px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  initial={{ opacity: 0, rotateY: -14, rotateX: 6, scale: 0.94 }}
                  animate={{ opacity: 1, rotateY: 0, rotateX: 0, scale: 1 }}
                  exit={{ opacity: 0, rotateY: 14, rotateX: -6, scale: 0.94 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="relative"
                >
                  <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-teal/15 via-transparent to-gold/20 blur-2xl" />
                  <div className="relative h-[42svh] min-h-64 overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-card sm:p-6 lg:h-[460px]">
                    <step.Visual />
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Алхам бүрийн жижиг "амьд" зураг ──
const stagger = (i: number) => ({
  initial: { opacity: 0, x: -16 },
  animate: { opacity: 1, x: 0 },
  transition: { delay: 0.1 + i * 0.09, duration: 0.35 },
});

function VisualFolders() {
  const rows: [LucideIcon, string, string, string][] = [
    [FolderLock, "Миний файлууд", "Зөвхөн та", "#be123c"],
    [Users, "Төслүүд", "Урьсан хүмүүс / бүх компани", "#2563eb"],
    [BookMarked, "Компанийн сан", "Бүгд харна, админ засна", "#b45309"],
    [Trash2, "Хогийн сав", "Сэргээх боломжтой", "#8a817c"],
  ];
  return (
    <div className="flex h-full flex-col justify-center gap-3">
      {rows.map(([I, name, hint, color], i) => (
        <motion.div key={name} {...stagger(i)} className="flex items-center gap-3 rounded-xl border border-border bg-background p-3.5">
          <span className="grid h-10 w-10 place-items-center rounded-lg" style={{ background: `${color}1a`, color }}>
            <I className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium">{name}</div>
            <div className="text-xs text-muted-foreground">{hint}</div>
          </div>
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{[12, 38, 64, 3][i]}</span>
        </motion.div>
      ))}
    </div>
  );
}

function VisualEditor() {
  const reduce = useReducedMotion();
  return (
    <div className="relative h-full rounded-xl border border-border bg-background p-5">
      <div className="mb-4 flex items-center gap-1.5 border-b border-border pb-3">
        {["B", "I", "U"].map((b) => (
          <span key={b} className="grid h-6 w-6 place-items-center rounded text-xs font-semibold text-muted-foreground">{b}</span>
        ))}
        <span className="ml-auto flex -space-x-1.5">
          <span className="h-6 w-6 rounded-full border-2 border-background bg-blue-500" />
          <span className="h-6 w-6 rounded-full border-2 border-background bg-amber-500" />
        </span>
      </div>
      <div className="font-display text-lg text-primary">Хэмжилтийн тайлан</div>
      <div className="mt-3 space-y-2.5">
        {[92, 78, 85, 60, 88, 70].map((w, i) => (
          <motion.div key={i} {...stagger(i)} className="h-2.5 rounded-full bg-muted" style={{ width: `${w}%` }} />
        ))}
      </div>
      {[
        { name: "Сараа", color: "bg-blue-500", top: "42%", x: ["10%", "55%", "30%"] },
        { name: "Очир", color: "bg-amber-500", top: "64%", x: ["60%", "20%", "45%"] },
      ].map((c) => (
        <motion.div
          key={c.name}
          className="absolute"
          style={{ top: c.top }}
          initial={{ left: c.x[0] }}
          animate={reduce ? { left: c.x[0] } : { left: c.x }}
          transition={{ duration: 5, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
        >
          <span className={cn("block h-5 w-0.5", c.color)} />
          <span className={cn("absolute -top-4 left-0 whitespace-nowrap rounded px-1.5 text-[10px] text-white", c.color)}>{c.name}</span>
        </motion.div>
      ))}
    </div>
  );
}

function VisualShare() {
  const people = [
    ["Бат", "Эзэмшигч", "#2563eb"],
    ["Сараа", "Засах", "#0f766e"],
    ["Очир", "Засах", "#b45309"],
    ["Номин", "Харах", "#7c3aed"],
  ];
  return (
    <div className="flex h-full flex-col justify-center">
      <div className="rounded-xl border border-border bg-background p-4">
        <div className="text-sm font-medium">“Зайсан гүүрийн суурь”-ийг хуваалцах</div>
        <div className="mt-3 rounded-lg border border-teal/50 px-3 py-2 text-xs text-muted-foreground">Нэр эсвэл имэйлээр хайх…</div>
        <div className="mt-3 space-y-2">
          {people.map(([n, r, c], i) => (
            <motion.div key={n} {...stagger(i)} className="flex items-center gap-2.5 text-sm">
              <span className="grid h-7 w-7 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: c }}>{n[0]}</span>
              {n}
              <span className="ml-auto text-xs text-muted-foreground">{r}</span>
            </motion.div>
          ))}
        </div>
        <motion.div {...stagger(5)} className="mt-4 flex items-center gap-2.5 rounded-lg bg-muted/70 p-2.5 text-xs">
          <Building2 className="h-4 w-4 text-teal" />
          <span className="font-medium">Компанийн бүх хүн</span>
          <span className="text-muted-foreground">харах боломжтой</span>
        </motion.div>
      </div>
    </div>
  );
}

function VisualTasks() {
  const tasks = [
    ["Хээрийн хэмжилт — Зайсан", "bg-red-500", "10/18", true],
    ["Координатын файл шалгах", "bg-orange-500", "10/20", true],
    ["Тайлангийн ноорог", "bg-amber-400", "10/24", false],
    ["Захиалагчид хүлээлгэн өгөх", "bg-slate-300", "10/30", false],
  ] as const;
  return (
    <div className="flex h-full flex-col justify-center gap-2.5">
      {tasks.map(([t, dot, due, done], i) => (
        <motion.div key={t} {...stagger(i)} className="flex items-center gap-3 rounded-xl border border-border bg-background p-3.5 text-sm">
          <motion.span
            initial={{ scale: 0.6, backgroundColor: "rgba(0,0,0,0)" }}
            animate={done ? { scale: 1, backgroundColor: "var(--teal)" } : { scale: 1 }}
            transition={{ delay: 0.5 + i * 0.25 }}
            className="grid h-5 w-5 shrink-0 place-items-center rounded-md border border-teal"
          >
            {done && <Check className="h-3.5 w-3.5 text-white" />}
          </motion.span>
          <span className={cn("min-w-0 flex-1 truncate", done && "text-muted-foreground line-through")}>{t}</span>
          <span className={cn("h-2 w-2 rounded-full", dot)} />
          <span className="text-xs text-muted-foreground">{due}</span>
        </motion.div>
      ))}
      <motion.div {...stagger(5)} className="flex items-center gap-2 text-xs text-muted-foreground">
        <Bell className="h-3.5 w-3.5 text-teal" /> Сараад “Тайлангийн ноорог” оноогдлоо — имэйл илгээгдлээ
      </motion.div>
    </div>
  );
}

function VisualBoard() {
  const reduce = useReducedMotion();
  const cols = ["Захиалга", "Хээрт", "Боловсруулалт", "Хүлээлгэсэн"];
  return (
    <div className="relative grid h-full grid-cols-4 gap-2">
      {cols.map((c, i) => (
        <div key={c} className="flex flex-col gap-2 rounded-xl bg-muted/60 p-2">
          <div className="truncate px-1 text-[11px] font-medium text-muted-foreground">{c}</div>
          {Array.from({ length: [2, 1, 2, 1][i] }, (_, j) => (
            <motion.div key={j} {...stagger(i + j)} className="rounded-lg border border-border bg-background p-2">
              <div className="h-2 w-4/5 rounded-full bg-muted-foreground/25" />
              <div className="mt-1.5 h-1.5 w-1/2 rounded-full bg-muted" />
            </motion.div>
          ))}
        </div>
      ))}
      <motion.div
        className="absolute top-[38%] w-[23%] rounded-lg border-2 border-teal bg-background p-2 shadow-card"
        animate={reduce ? { left: "26%" } : { left: ["1%", "26%", "51%", "76%"] }}
        transition={{ duration: 6, repeat: Infinity, repeatDelay: 0.8, ease: "easeInOut", times: [0, 0.33, 0.66, 1] }}
      >
        <div className="truncate text-[10px] font-medium">Хан-Уул 15</div>
        <div className="mt-0.5 truncate text-[9px] text-muted-foreground">Тэнгэр ХХК · 10/30</div>
      </motion.div>
    </div>
  );
}

function VisualMap() {
  const pts = [
    [70, 60],
    [250, 40],
    [330, 150],
    [270, 260],
    [110, 240],
    [50, 150],
  ];
  const d = `M${pts.map((p) => p.join(",")).join(" L")} Z`;
  return (
    <div className="relative h-full overflow-hidden rounded-xl bg-[oklch(0.32_0.04_150)]">
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:40px_40px]" />
      <svg viewBox="0 0 380 300" className="absolute inset-0 h-full w-full p-4">
        <motion.path
          d={d}
          fill="var(--gold)"
          fillOpacity={0.18}
          stroke="var(--gold)"
          strokeWidth={2.5}
          initial={{ pathLength: 0, fillOpacity: 0 }}
          animate={{ pathLength: 1, fillOpacity: 0.18 }}
          transition={{ duration: 1.6, ease: "easeInOut" }}
        />
        {pts.map(([x, y], i) => (
          <motion.g key={i} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 + i * 0.2 }}>
            <circle cx={x} cy={y} r={5} fill="white" stroke="var(--teal)" strokeWidth={2} />
            <text x={x + 8} y={y - 6} fontSize={10} fill="white">
              {i + 1}
            </text>
          </motion.g>
        ))}
      </svg>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.6 }}
        className="absolute bottom-3 left-3 rounded-lg bg-white/95 px-3 py-2 text-xs shadow-card"
      >
        <div className="font-semibold">Талбай: 1,245.6 м²</div>
        <div className="text-muted-foreground">Периметр 148.3 м · Гэрчилгээнээс +0.45%</div>
      </motion.div>
    </div>
  );
}

function VisualEquipment() {
  const rows = [
    ["Leica TS06 тахеометр", "11/12 дуусна", "bg-amber-100 text-amber-800"],
    ["GNSS хүлээн авагч №2", "Дууссан", "bg-red-100 text-red-700"],
    ["Нивелир Sokkia B40", "2027/03", "bg-green-100 text-green-800"],
    ["Тусгай зөвшөөрөл", "2026/12", "bg-green-100 text-green-800"],
  ];
  return (
    <div className="flex h-full flex-col justify-center gap-2.5">
      {rows.map(([n, s, tone], i) => (
        <motion.div key={n} {...stagger(i)} className="flex items-center gap-3 rounded-xl border border-border bg-background p-3.5 text-sm">
          <Wrench className="h-4 w-4 shrink-0 text-amber-600" />
          <span className="min-w-0 flex-1 truncate">{n}</span>
          <motion.span
            className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", tone)}
            animate={s === "Дууссан" ? { scale: [1, 1.08, 1] } : undefined}
            transition={{ duration: 1.4, repeat: Infinity }}
          >
            {s}
          </motion.span>
        </motion.div>
      ))}
    </div>
  );
}

// ── Бүтэц: хулганаар хазайдаг 3D картууд ──
function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 200, damping: 18 });
  const sry = useSpring(ry, { stiffness: 200, damping: 18 });
  return (
    <div className="h-full [perspective:900px]">
      <motion.div
        style={{ rotateX: srx, rotateY: sry }}
        onPointerMove={(e) => {
          if (reduce || e.pointerType !== "mouse") return;
          const r = e.currentTarget.getBoundingClientRect();
          rx.set(((e.clientY - r.top) / r.height - 0.5) * -12);
          ry.set(((e.clientX - r.left) / r.width - 0.5) * 12);
        }}
        onPointerLeave={() => {
          rx.set(0);
          ry.set(0);
        }}
        className={className}
      >
        {children}
      </motion.div>
    </div>
  );
}

function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionHead({ kicker, title, text }: { kicker: string; title: string; text: string }) {
  return (
    <Reveal className="mx-auto max-w-3xl text-center">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-teal">{kicker}</p>
      <h2 className="mt-3 font-display text-4xl leading-tight text-primary sm:text-5xl">{title}</h2>
      <p className="mt-4 text-muted-foreground">{text}</p>
    </Reveal>
  );
}

function Structure() {
  const cards: [LucideIcon, string, string, string, string][] = [
    [FolderLock, "Миний файлууд", "Хувийн ноорог, тэмдэглэл. Зөвхөн та өөрөө харна — админ ч нээхгүй.", "#be123c", "Зөвхөн та"],
    [Users, "Төслүүд", "Багийн ажил. Урьсан хүмүүс эсвэл компанийн бүх хүн — эрхийг та сонгоно.", "#2563eb", "Баг"],
    [BookMarked, "Компанийн сан", "Загвар, журам, стандарт. Бүгд харна, зөвхөн админ засна.", "#b45309", "Бүх компани"],
    [Trash2, "Хогийн сав", "Устгасан төсөл энд түр хадгалагдана. Андуурсан бол нэг товчоор сэргээнэ.", "#8a817c", "Аюулгүй"],
  ];
  return (
    <section id="structure" className="bg-muted/40 px-4 py-28 sm:px-6">
      <SectionHead
        kicker="Ойлгомжтой бүтэц"
        title="Дөрөвхөн газар. Төөрөх аргагүй."
        text="Файл хаана байгаа нь хэн харахыг шууд хэлнэ. Шинэ ажилтан эхний өдрөөсөө ойлгоно."
      />
      <div className="mx-auto mt-14 grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([I, title, text, color, tag], i) => (
          <Reveal key={title} delay={i * 0.08} className="h-full">
            <TiltCard className="h-full rounded-2xl border border-border bg-card p-6 shadow-soft transition-shadow hover:shadow-card">
              <span className="grid h-12 w-12 place-items-center rounded-xl" style={{ background: `${color}1a`, color }}>
                <I className="h-6 w-6" />
              </span>
              <h3 className="mt-5 font-sans text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
              <span className="mt-5 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ background: `${color}14`, color }}>
                {tag}
              </span>
            </TiltCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Tools() {
  const tools: [LucideIcon, string, string, string][] = [
    [Search, "Нэг хайлт", "Файл, төслийг нэрээр нь хаанаас ч олно.", "text-blue-600 bg-blue-100"],
    [History, "Хувилбарын түүх", "Хэн, хэзээ юу өөрчилснийг харна.", "text-teal bg-teal/15"],
    [MessageSquare, "Сэтгэгдэл", "Файл дээр шууд асууж, хариулна. Имэйлээр мэдэгдэнэ.", "text-violet-700 bg-violet-100"],
    [KanbanSquare, "Ажлын самбар", "Ажлын шат, захиалагч, хугацаа.", "text-blue-700 bg-blue-100"],
    [MapPin, "Координат харагч", "Талбай, периметр, каталог, KML/DXF.", "text-green-700 bg-green-100"],
    [Wrench, "Багаж, зөвшөөрөл", "Баталгаажуулалтын хугацааны сануулга.", "text-amber-700 bg-amber-100"],
  ];
  return (
    <section id="tools" className="px-4 py-28 sm:px-6">
      <SectionHead
        kicker="Хэрэгслүүд"
        title="Хэмжилтийн ажилд зориулж хийсэн"
        text="Ерөнхий файлын сангаас ялгаатай нь Terra Line Workspace геодезийн өдөр тутмын ажлыг мэддэг."
      />
      <div className="mx-auto mt-14 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map(([I, title, text, tone], i) => (
          <Reveal key={title} delay={(i % 3) * 0.08} className="h-full">
            <div className="group flex h-full gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:-translate-y-1 hover:shadow-card">
              <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-transform group-hover:scale-110", tone)}>
                <I className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-sans text-base font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      {/* AI багц — сонголтот */}
      <Reveal className="mx-auto mt-6 max-w-6xl">
        <div className="relative overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-card p-6 sm:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-violet-600 text-white shadow-lg">
              <Sparkles className="h-7 w-7" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium uppercase tracking-widest text-violet-700">Нэмэлт багц</div>
              <h3 className="mt-1 font-display text-2xl text-primary">AI туслах</h3>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                “Хан-Уулд шинэ ажил, 10/30-нд дуусна, Батаад оноо” гэж бичихэд ажил, даалгавар өөрөө
                үүснэ. Тайлангийн ноорог бичиж, файл хайж өгнө — таны “Тийм”-гүйгээр юу ч өөрчлөгдөхгүй.
              </p>
            </div>
            <div className="flex shrink-0 items-start gap-2 rounded-xl bg-card p-3 text-xs shadow-soft">
              <Bot className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
              <span className="max-w-56">Ажил үүсгэлээ: “Хан-Уул 15 — кадастр”. Батад даалгавар оноох уу?</span>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Security() {
  const items: [LucideIcon, string, string][] = [
    [Lock, "Эрхийн хатуу хяналт", "Хүн бүр зөвхөн өөрт нээлттэй файлаа харна. Хувийн файлыг админ ч нээхгүй."],
    [ShieldCheck, "Админы зөвшөөрөл", "Шинэ хэрэглэгч админ баталгаажуулсны дараа л нэвтэрнэ."],
    [History, "Бүх үйлдэл бүртгэлтэй", "Хэн файл нээж, татаж, өөрчилснийг хадгална."],
    [Trash2, "Андуурч устгахаас хамгаална", "Төсөл эхлээд хогийн саванд орж, сэргээх боломжтой."],
  ];
  return (
    <section id="security" className="relative overflow-hidden bg-sidebar px-4 py-28 text-white sm:px-6">
      <Contours className="opacity-25" />
      <Reveal className="relative mx-auto max-w-3xl text-center">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-gold">Аюулгүй байдал</p>
        <h2 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">Компанийн мэдээлэл компанидаа</h2>
        <p className="mt-4 text-white/65">Гэрээ, кадастрын материал, хувийн мэдээллийг зөв хүн л харна.</p>
      </Reveal>
      <div className="relative mx-auto mt-14 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(([I, title, text], i) => (
          <Reveal key={title} delay={i * 0.08} className="h-full">
            <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <I className="h-6 w-6 text-gold" />
              <h3 className="mt-4 font-sans text-base font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <>
      <section className="px-4 py-28 text-center sm:px-6">
        <Reveal className="mx-auto max-w-3xl">
          <h2 className="font-display text-4xl leading-tight text-primary sm:text-6xl">
            Өнөөдрийн ажлаа <span className="italic text-teal">эндээс</span> эхлүүл.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
            Компанийн имэйл эсвэл Google хаягаараа нэвтэрнэ. Админ зөвшөөрмөгц ажлын орчин бэлэн.
          </p>
          <Link
            href="/login"
            className="group mt-9 inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90"
          >
            Нэвтрэх
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Reveal>
      </section>
      <footer className="border-t border-border px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <TlsLogo size="sm" showText />
          <span>© {new Date().getFullYear()} Terra Line Survey</span>
        </div>
      </footer>
    </>
  );
}
