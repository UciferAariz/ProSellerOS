import { cn } from "@/lib/utils";

const VARIANT_COLOR: Record<string, string> = {
  default: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  secondary: "bg-muted-foreground",
};

const VARIANT_BG: Record<string, string> = {
  default: "bg-primary/10 text-primary",
  success: "bg-success/12 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/12 text-danger",
  info: "bg-info/12 text-info",
  secondary: "bg-secondary text-muted-foreground",
};

export function StatusPill({
  label,
  variant = "default",
  pulse = false,
  className,
}: {
  label: string;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "secondary";
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        VARIANT_BG[variant],
        className
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          VARIANT_COLOR[variant],
          pulse && "pulse-dot"
        )}
      />
      {label}
    </span>
  );
}
