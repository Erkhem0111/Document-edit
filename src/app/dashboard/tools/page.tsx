"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { KanbanSquare, LayoutGrid, MapPin, Sparkles, Wrench, type LucideIcon } from "lucide-react";
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
          Ажлыг хөнгөвчлөх нэмэлт хэрэгслүүд. Ашиглахгүй бол хаана ч саад болохгүй.
        </p>
      </div>

      <div className="mt-5 grid max-w-5xl gap-3 md:grid-cols-2">
        <ToolCard
          href="/dashboard/tools/jobs"
          icon={KanbanSquare}
          tint="bg-blue-100 text-blue-700"
          title="Ажлын самбар"
          desc="Бүх ажил аль шатандаа явааг нэг дор. Карт чирээд шатыг солино. Ажил бүр одоо байгаа төсөлтэйгээ холбоотой."
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
          desc="CSV/TXT координатын файлыг зураг дээр харж, талбай, периметрийг тооцоолно. X/Y солигдсон цэгийг илрүүлнэ."
        >
          <Badge className="bg-muted text-muted-foreground">UTM 46–50 · MONREF97</Badge>
        </ToolCard>
        <ToolCard
          href="/dashboard/tools/equipment"
          icon={Wrench}
          tint="bg-amber-100 text-amber-700"
          title="Багаж, зөвшөөрөл"
          desc="Багажийн баталгаажуулалт, тусгай зөвшөөрлийн хугацааг бүртгэнэ. Дуусахаас 30 хоногийн өмнө анхааруулна."
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
          desc="“Шинэ ажил: Хан-Уул, 10/30” гэж бичихэд өөрөө бөглөнө, тайлангийн ноорог бичнэ. Сонголтоор идэвхжүүлэх нэмэлт багц."
          highlight
        >
          <Badge className="bg-violet-100 text-violet-700">Багц</Badge>
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
  highlight,
  children,
}: {
  href: string;
  icon: LucideIcon;
  tint: string;
  title: string;
  desc: string;
  highlight?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex items-start gap-3.5 rounded-xl border p-4 transition hover:-translate-y-px hover:shadow-soft ${
        highlight ? "border-violet-200 bg-violet-50/60" : "border-border bg-card"
      }`}
    >
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${tint}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-medium text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{desc}</span>
        {children && <span className="mt-2.5 flex flex-wrap gap-1.5">{children}</span>}
      </span>
    </Link>
  );
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}>{children}</span>;
}
