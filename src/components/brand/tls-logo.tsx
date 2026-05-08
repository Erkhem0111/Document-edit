import Image from "next/image";
import { cn } from "@/lib/utils";

type TlsLogoProps = {
  size?: "sm" | "md" | "lg" | "hero";
  showText?: boolean;
  className?: string;
};

const logoSize = {
  sm: "size-14",
  md: "size-20",
  lg: "size-28",
  hero: "size-36 sm:size-44",
};

export function TlsLogo({
  size = "md",
  showText = false,
  className,
}: TlsLogoProps) {
  return (
    <div className={cn("flex flex-col items-center text-center", className)}>
      <div
        className={cn(
          "overflow-hidden rounded-[8px] border border-[#d9c58f] bg-white shadow-sm",
          logoSize[size],
        )}
      >
        <Image
          src="/logo.png"
          alt="Terra Line Survey logo"
          width={260}
          height={260}
          className="h-full w-full object-cover"
          priority
        />
      </div>
      {showText && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-[#9a711d]">
            Terra Line Survey
          </p>
          <p className="mt-1 text-xs text-[#6b7780]">Document workspace</p>
        </div>
      )}
    </div>
  );
}
