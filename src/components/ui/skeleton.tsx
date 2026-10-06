import { cn } from "@/lib/utils";

// Ачаалж байх үед жинхэнэ контентын хэлбэрийг дуурайсан саарал блок.
// Хоосон "Loading…" бичгээс илүү хурдан мэдрэмж төрүүлж, контент гарч ирэхэд
// layout үсрэхгүй.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
