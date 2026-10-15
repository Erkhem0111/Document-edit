"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  KanbanSquare,
  LayoutGrid,
  MapPin,
  Sparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { overdueDays } from "@/lib/jobs";
import { expiryState } from "@/lib/equipment";

// ─── Хэрэгслүүд ───────────────────────────────────────────────────────────────
// Нэмэлт функц бүгд энд, тус бүр өөрийн хуудастай. Нээж байж л ашиглана —
// ашигладаггүй хүнд файл, төслийн хуудас өөрчлөгдөхгүй.

type JobLite = { jobStage: string | null; jobDueDate: string | null };

export default function ToolsPage() {
  const [jobs, setJobs] = useState<JobLite[] | null>(null);
  const [alerts, setAlerts] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/jobs")
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((d: { jobs?: JobLite[] }) => {
        if (alive) setJobs(d.jobs ?? []);
      })
      .catch(() => alive && setJobs([]));
    fetch("/api/equipment")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: Array<{ expiresAt: string | null }> }) => {
        if (alive) setAlerts((d.items ?? []).filter((i) => expiryState(i.expiresAt) !== "ok" && expiryState(i.expiresAt) !== "none").length);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const active = jobs?.filter((j) => j.jobStage !== "DELIVERED").length ?? 0;
  const late = jobs?.filter((j) => overdueDays(j) > 0).length ?? 0;

  return (
    <div className="px-4 py-5 md:px-8">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="flex items-center gap-2 font-sans text-lg md:text-xl">
          <LayoutGrid className="h-5 w-5 text-teal" />
          Хэрэгслүүд
        </h1>
        <p className="text-xs text-muted-foreground">
          Өдөр тутмын ажлыг хөнгөвчлөх нэмэлт хэрэгслүүд. Ашиглахгүй бол хаана ч саад болохгүй.
        </p>
      </div>

      <div className="mt-6 grid max-w-6xl gap-4 md:grid-cols-2">
        <ToolCard
          href="/dashboard/tools/jobs"
          icon={KanbanSquare}
          tint="bg-blue-100 text-blue-700"
          title="Ажлын самбар"
          desc="Компанийн бүх хэмжилтийн ажил аль шатандаа явааг нэг самбараас харна."
          points={[
            "Захиалга → Хээрийн хэмжилт → Боловсруулалт → Хүлээлгэн өгсөн",
            "Картыг чирээд шатыг нь солино, хугацаа хэтэрвэл улаанаар анхааруулна",
            "Ажил бүр өөрийн төслийн файлуудтай холбоотой",
          ]}
          cta="Самбар нээх"
        >
          {jobs && (
            <>
              <Badge className="bg-blue-100 text-blue-700">{active} идэвхтэй</Badge>
              {late > 0 && <Badge className="bg-red-100 text-red-700">{late} хоцорсон</Badge>}
            </>
          )}
        </ToolCard>
        <ToolCard
          href="/dashboard/tools/coordinates"
          icon={MapPin}
          tint="bg-green-100 text-green-700"
          title="Координат харагч"
          desc="Багажнаас гарсан координатын файлыг хиймэл дагуулын зураг дээр шууд харна."
          points={[
            "CSV/TXT файл оруулахад талбай, периметрийг тооцоолно",
            "X/Y солигдсон, алдаатай цэг, огтлолцсон хилийг илрүүлнэ",
            "Гэрчилгээний талбайтай харьцуулж, каталогийг Word-оор гаргана",
          ]}
          cta="Файл шалгах"
        >
          <Badge className="bg-muted text-muted-foreground">UTM 46–50 · MONREF97</Badge>
        </ToolCard>
        <ToolCard
          href="/dashboard/tools/equipment"
          icon={Wrench}
          tint="bg-amber-100 text-amber-700"
          title="Багаж, зөвшөөрөл"
          desc="Багажийн баталгаажуулалт, тусгай зөвшөөрлийн хугацааг мартахгүй."
          points={[
            "GNSS, тахеометр, нивелир болон зөвшөөрлөө бүртгэнэ",
            "Дуусахаас 30 хоногийн өмнө анхааруулна",
            "Гэрчилгээний хуулбарыг хавсаргаж хадгална",
          ]}
          cta="Бүртгэл нээх"
        >
          {alerts != null && alerts > 0 && (
            <Badge className="bg-red-100 text-red-700">⚠ {alerts} дуусах/дууссан</Badge>
          )}
        </ToolCard>
        <ToolCard
          href="/dashboard/tools/ai"
          icon={Sparkles}
          tint="bg-violet-100 text-violet-700"
          title="AI туслах"
          desc="Энгийн өгүүлбэрээр бичихэд системийн ажлыг таны оронд хийдэг туслах."
          points={[
            "“Хан-Уулд шинэ ажил, 10/30-нд дуусна” → ажил, даалгавар өөрөө үүснэ",
            "Хэмжилтийн тайлангийн ноорог, захидлыг бичиж өгнө",
            "Төлбөртэй нэмэлт багц — дэлгэрэнгүйг нээж уншина уу",
          ]}
          cta="Дэлгэрэнгүй"
        >
          <Badge className="bg-violet-100 text-violet-700">Нэмэлт багц</Badge>
        </ToolCard>
      </div>
    </div>
  );
}

function ToolCard({
  href,
  icon: Icon,
  tint,
  title,
  desc,
  points,
  cta,
  children,
}: {
  href: string;
  icon: LucideIcon;
  tint: string;
  title: string;
  desc: string;
  points: string[];
  cta: string;
  children?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-2xl border border-border bg-card p-6 shadow-soft transition hover:-translate-y-0.5 hover:border-teal/40 hover:shadow-card"
    >
      <div className="flex items-start gap-4">
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${tint}`}>
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h2 className="font-sans text-lg font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{desc}</p>
        </div>
      </div>
      <ul className="mt-4 space-y-2 text-sm text-foreground/85">
        {points.map((point) => (
          <li key={point} className="flex gap-2.5">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-5">
        {children}
        <span className="ml-auto flex items-center gap-1 text-sm font-medium text-teal">
          {cta}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}>{children}</span>;
}
