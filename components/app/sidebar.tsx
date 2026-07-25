"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Boxes,
  Users,
  Wallet,
  Megaphone,
  BarChart3,
  Workflow,
  Sparkles,
  Plug,
  Settings,
  LifeBuoy,
  ChevronLeft,
} from "lucide-react";
import { BrandLogo, BrandMark } from "@/components/brand";
import { StatusPill } from "./status-pill";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  soon?: boolean;
}

const MAIN: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Products", href: "/products", icon: Package },
  { label: "Orders", href: "/orders", icon: ShoppingCart, badge: "1.2K" },
  { label: "Marketplaces", href: "/marketplaces", icon: Plug },
  { label: "AI Assistant", href: "/assistant", icon: Sparkles },
];

const SECONDARY: NavItem[] = [
  { label: "Inventory", href: "/inventory", icon: Boxes },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Finance", href: "/finance", icon: Wallet },
  { label: "Marketing", href: "/marketing", icon: Megaphone },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Automation", href: "/automation", icon: Workflow },
];

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200 md:flex",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div className="flex h-16 items-center justify-between px-3">
        <Link href="/dashboard" className="overflow-hidden">
          {collapsed ? <BrandMark /> : <BrandLogo />}
        </Link>
        <button
          onClick={onToggle}
          className={cn(
            "flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
            collapsed && "absolute left-14 top-5 z-10 border border-border bg-card shadow-sm"
          )}
        >
          <ChevronLeft className={cn("size-4 transition-transform", collapsed && "rotate-180")} />
        </button>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
        <NavGroup items={MAIN} pathname={pathname} collapsed={collapsed} />
        <div>
          {!collapsed && (
            <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Modules
            </p>
          )}
          <NavGroup items={SECONDARY} pathname={pathname} collapsed={collapsed} />
        </div>
      </nav>

      <div className="space-y-1 border-t border-sidebar-border p-3">
        <NavLink
          item={{ label: "Settings", href: "#", icon: Settings }}
          active={false}
          collapsed={collapsed}
        />
        <NavLink
          item={{ label: "Support", href: "#", icon: LifeBuoy }}
          active={false}
          collapsed={collapsed}
        />
        {!collapsed && (
          <div className="mt-2 rounded-lg border border-border bg-card p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Scale plan</span>
              <StatusPill label="Active" variant="success" />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              68% of order quota used
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full w-[68%] rounded-full bg-primary" />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function NavGroup({
  items,
  pathname,
  collapsed,
}: {
  items: NavItem[];
  pathname: string;
  collapsed: boolean;
}) {
  return (
    <div className="space-y-0.5">
      {items.map((item) => (
        <NavLink
          key={item.label}
          item={item}
          active={pathname === item.href}
          collapsed={collapsed}
        />
      ))}
    </div>
  );
}

function NavLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-sidebar-foreground hover:bg-secondary hover:text-foreground",
        item.soon && "cursor-default"
      )}
    >
      {active && (
        <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" />
      )}
      <Icon className="size-[18px] shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge && (
            <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {item.badge}
            </span>
          )}
          {item.soon && (
            <span className="rounded-full border border-border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              Soon
            </span>
          )}
        </>
      )}
    </Link>
  );
}
