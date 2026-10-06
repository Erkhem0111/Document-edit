import { Skeleton } from "@/components/ui/skeleton";

// Хуудас бүрийн жинхэнэ layout-ыг дуурайсан skeleton-ууд.
// Өгөгдөл ирэхэд яг ижил байрлалд контент солигдох тул хуудас "үсрэхгүй".

// Жагсаалтын мөрүүд (файл, folder, task, хэрэглэгч)
export function ListRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Ачаалж байна">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-border/60 px-5 py-3 last:border-b-0"
        >
          <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5" style={{ width: `${55 - (i % 3) * 12}%` }} />
            <Skeleton className="h-2.5 w-24" />
          </div>
          <Skeleton className="hidden h-3 w-24 lg:block" />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

// Гарчиг + жагсаалт бүхий хуудас (төсөл, folder)
export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="px-5 py-6 md:px-10 md:py-10">
      <Skeleton className="h-3 w-24" />
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-3">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="border-b border-border bg-muted/40 px-5 py-3">
          <Skeleton className="h-2.5 w-20" />
        </div>
        <ListRowsSkeleton rows={rows} />
      </div>
    </div>
  );
}

// Баримт засварлагч (toolbar + цаас)
export function FileEditorSkeleton() {
  return (
    <div className="flex min-h-full flex-col bg-background" aria-busy="true">
      <div className="flex items-center gap-3 border-b border-border px-6 py-3">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-5 w-56" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      <div className="flex gap-2 border-b border-border px-6 py-2">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="h-7 w-7" />
        ))}
      </div>
      <div className="px-6 py-12">
        <div className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-border bg-card px-12 py-12">
          <Skeleton className="h-7 w-1/2" />
          {[92, 100, 85, 96, 60, 0, 88, 94, 70].map((w, i) =>
            w ? <Skeleton key={i} className="h-3.5" style={{ width: `${w}%` }} /> : <div key={i} className="h-3" />,
          )}
        </div>
      </div>
    </div>
  );
}

// Нэвтрэлтийг шалгах хооронд бүх workspace-ийн хүрээ
export function WorkspaceSkeleton() {
  return (
    <div className="grid h-screen grid-cols-[240px_1fr] overflow-hidden bg-background xl:grid-cols-[280px_1fr_300px]">
      <aside className="flex flex-col gap-4 border-r border-sidebar-border bg-sidebar p-5">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-8 w-8 rounded-full bg-sidebar-accent" />
          <Skeleton className="h-4 w-24 bg-sidebar-accent" />
        </div>
        <Skeleton className="mt-4 h-7 bg-sidebar-accent" />
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-4 bg-sidebar-accent" style={{ width: `${80 - (i % 3) * 15}%` }} />
        ))}
      </aside>
      <PageSkeleton />
      <aside className="hidden flex-col gap-3 border-l border-border bg-card/40 p-5 xl:flex">
        <Skeleton className="h-3 w-20" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      </aside>
    </div>
  );
}
