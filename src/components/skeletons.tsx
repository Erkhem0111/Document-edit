import { Skeleton } from "@/components/ui/skeleton";

// Хуудас бүрийн жинхэнэ layout-ыг дуурайсан skeleton-ууд.
// Өгөгдөл ирэхэд яг ижил байрлалд контент солигдох тул хуудас "үсрэхгүй".

// Жагсаалтын мөрүүд (файл, folder, task, хэрэглэгч) — шинэ нягт жагсаалттай ижил өндөр
export function ListRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Ачаалж байна">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-2.5 px-2 py-2">
          <Skeleton className="h-7 w-7 shrink-0 rounded-md" />
          <Skeleton className="h-3.5" style={{ width: `${45 - (i % 3) * 10}%` }} />
          <Skeleton className="ml-auto hidden h-3 w-20 md:block" />
          <Skeleton className="hidden h-3 w-12 sm:block" />
        </div>
      ))}
    </div>
  );
}

// Folder-ын дотор / жагсаалттай хуудас
export function PageSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="px-4 py-5 md:px-8">
      <div className="flex items-center gap-3">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="ml-auto h-8 w-28 rounded-full" />
      </div>
      <div className="mt-6">
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

// Нэвтрэлтийг шалгах хооронд бүх workspace-ийн хүрээ (layout.tsx-тэй ижил бүтэц)
export function WorkspaceSkeleton() {
  return (
    <div className="grid h-dvh overflow-hidden bg-background md:grid-cols-[260px_1fr]">
      <aside className="hidden flex-col gap-3 bg-sidebar p-4 md:flex">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-8 w-8 rounded-full bg-sidebar-accent" />
          <Skeleton className="h-4 w-24 bg-sidebar-accent" />
        </div>
        <Skeleton className="mt-2 h-10 w-24 rounded-xl bg-sidebar-accent" />
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton
            key={i}
            className="h-3.5 bg-sidebar-accent"
            style={{ width: `${75 - (i % 3) * 15}%` }}
          />
        ))}
      </aside>
      <div className="flex flex-col">
        <div className="border-b border-border/70 px-6 py-2.5">
          <Skeleton className="h-9 w-full max-w-2xl rounded-full" />
        </div>
        <div className="px-8 py-5">
          <Skeleton className="h-6 w-56" />
          <div className="mt-6">
            <ListRowsSkeleton rows={6} />
          </div>
        </div>
      </div>
    </div>
  );
}
