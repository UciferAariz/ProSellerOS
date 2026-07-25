"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Plug,
  Sparkles,
} from "lucide-react";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import {
  CommandPalette,
  useCommandPalette,
} from "@/components/app/command-palette";
import { CopilotProvider } from "@/components/copilot/copilot-provider";
import { CopilotDock } from "@/components/copilot/copilot-dock";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { BrandLogo } from "@/components/brand";
import { cn } from "@/lib/utils";

const MOBILE_NAV = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Products", href: "/products", icon: Package },
  { label: "Orders", href: "/orders", icon: ShoppingCart },
  { label: "Marketplaces", href: "/marketplaces", icon: Plug },
  { label: "AI Assistant", href: "/assistant", icon: Sparkles },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { open, setOpen } = useCommandPalette();
  const pathname = usePathname();
  const router = useRouter();

  // lightweight demo auth guard
  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("pso_authed")) {
      localStorage.setItem("pso_authed", "1"); // auto-auth for demo convenience
    }
  }, [router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <CopilotProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex h-16 items-center px-4">
            <BrandLogo />
          </div>
          <nav className="space-y-0.5 px-3">
            {MOBILE_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                  pathname === item.href
                    ? "bg-primary/10 text-primary"
                    : "text-sidebar-foreground hover:bg-secondary"
                )}
              >
                <item.icon className="size-[18px]" />
                {item.label}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            onMenuClick={() => setMobileOpen(true)}
            onSearchClick={() => setOpen(true)}
          />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>

        {/* A flex sibling, so docking the copilot reflows the page instead of
            covering the data being discussed. */}
        <CopilotDock />

        <CommandPalette open={open} onOpenChange={setOpen} />
      </div>
    </CopilotProvider>
  );
}
