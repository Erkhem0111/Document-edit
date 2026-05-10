import Image from "next/image";
import Link from "next/link";

export function BrandMark({
  withText = true,
  size = 40,
}: {
  withText?: boolean;
  size?: number;
}) {
  return (
    <Link href="/" className="flex items-center gap-3 group">
      <Image
        src="/logo1.png"
        alt="Terra Line Survey"
        width={size}
        height={size}
        className="rounded-md"
      />
      {withText && (
        <div className="leading-tight">
          <div className="font-display text-lg text-primary">Terra Line</div>
          <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
            Survey Workspace
          </div>
        </div>
      )}
    </Link>
  );
}
