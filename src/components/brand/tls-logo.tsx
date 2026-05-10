import Image from "next/image";
import { cn } from "@/lib/utils";

type TlsLogoProps = {
  size?: "sm" | "md" | "lg" | "hero";
  showText?: boolean;
  className?: string;
  markOnly?: boolean;
};

const logoSize = {
  sm: "size-10",
  md: "size-12",
  lg: "size-16",
  hero: "size-36 sm:size-44",
};

export function TlsLogo({
  size = "md",
  showText = false,
  className,
  markOnly = false,
}: TlsLogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className={cn("shrink-0 overflow-hidden rounded-full bg-card", logoSize[size])}>
        <Image
          src="/logo1.png"
          alt="Terra Line Survey logo"
          width={260}
          height={260}
          className="h-full w-full object-cover"
          priority
        />
      </div>
      {showText && !markOnly && (
        <div className="leading-tight">
          <p className="font-display text-lg text-primary">Terra Line</p>
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Survey Workspace
          </p>
        </div>
      )}
    </div>
  );
}
