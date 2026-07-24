import { cn } from "@/lib/utils";
import { MARKETPLACES, MarketplaceId } from "@/lib/mock/marketplaces";

export function MarketplaceLogo({
  id,
  size = 24,
  className,
}: {
  id: MarketplaceId;
  size?: number;
  className?: string;
}) {
  const m = MARKETPLACES[id];
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md font-bold text-white shrink-0",
        className
      )}
      style={{
        width: size,
        height: size,
        background: m.color,
        fontSize: size * 0.42,
        // ensure light-colored logos (noon yellow) keep contrast
        color: ["noon"].includes(id) ? "#1a1a1a" : "#fff",
      }}
      title={m.name}
    >
      {m.short}
    </span>
  );
}

export function MarketplaceBadge({
  id,
  className,
  withName = true,
}: {
  id: MarketplaceId;
  className?: string;
  withName?: boolean;
}) {
  const m = MARKETPLACES[id];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
      <MarketplaceLogo id={id} size={18} />
      {withName && <span className="font-medium">{m.name}</span>}
    </span>
  );
}
