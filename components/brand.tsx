import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-lg shadow-sm",
        className
      )}
      style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)" }}
    >
      <svg viewBox="0 0 32 32" className="size-5" fill="none">
        <path
          d="M9 21V11l7 5 7-5v10"
          stroke="#fff"
          strokeWidth="2.4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx="16" cy="16" r="1.8" fill="#fff" />
      </svg>
    </span>
  );
}

export function BrandLogo({
  className,
  showText = true,
}: {
  className?: string;
  showText?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <BrandMark />
      {showText && (
        <span className="text-[15px] font-semibold tracking-tight">
          ProSeller<span className="text-primary">OS</span>
        </span>
      )}
    </span>
  );
}
