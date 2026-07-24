"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Plug,
  Sparkles,
  Search,
  Moon,
  Sun,
  ArrowRight,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { MarketplaceLogo } from "./marketplace-badge";
import { PRODUCTS } from "@/lib/mock/products";
import { ORDERS } from "@/lib/mock/orders";

const PAGES = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Products", href: "/products", icon: Package },
  { label: "Orders", href: "/orders", icon: ShoppingCart },
  { label: "Marketplaces", href: "/marketplaces", icon: Plug },
  { label: "AI Assistant", href: "/assistant", icon: Sparkles },
];

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0" hideClose>
        <Command
          className="[&_[cmdk-input-wrapper]]:border-b [&_[cmdk-input-wrapper]]:border-border"
          filter={(value, search) =>
            value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="size-4 text-muted-foreground" />
            <Command.Input
              placeholder="Search products, orders, pages…"
              className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
              ESC
            </kbd>
          </div>
          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            <Command.Group
              heading="Pages"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              {PAGES.map((p) => (
                <Item key={p.href} value={`page ${p.label}`} onSelect={() => go(p.href)}>
                  <p.icon className="size-4 text-muted-foreground" />
                  {p.label}
                  <ArrowRight className="ml-auto size-3.5 text-muted-foreground" />
                </Item>
              ))}
            </Command.Group>

            <Command.Group
              heading="Products"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              {PRODUCTS.slice(0, 6).map((p) => (
                <Item
                  key={p.id}
                  value={`product ${p.name} ${p.sku}`}
                  onSelect={() => go(`/products/${p.id}`)}
                >
                  <span
                    className="size-5 shrink-0 rounded"
                    style={{ background: p.image }}
                  />
                  <span className="truncate">{p.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{p.sku}</span>
                </Item>
              ))}
            </Command.Group>

            <Command.Group
              heading="Recent orders"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              {ORDERS.slice(0, 5).map((o) => (
                <Item
                  key={o.id}
                  value={`order ${o.number} ${o.customer}`}
                  onSelect={() => go(`/orders/${o.id}`)}
                >
                  <MarketplaceLogo id={o.marketplace} size={18} />
                  <span>{o.number}</span>
                  <span className="text-xs text-muted-foreground">· {o.customer}</span>
                </Item>
              ))}
            </Command.Group>

            <Command.Group
              heading="Actions"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              <Item
                value="toggle theme dark light"
                onSelect={() => {
                  setTheme(resolvedTheme === "dark" ? "light" : "dark");
                  onOpenChange(false);
                }}
              >
                {resolvedTheme === "dark" ? (
                  <Sun className="size-4 text-muted-foreground" />
                ) : (
                  <Moon className="size-4 text-muted-foreground" />
                )}
                Toggle theme
              </Item>
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function Item({
  children,
  value,
  onSelect,
}: {
  children: React.ReactNode;
  value: string;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm outline-none data-[selected=true]:bg-secondary"
    >
      {children}
    </Command.Item>
  );
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);
  return { open, setOpen };
}
