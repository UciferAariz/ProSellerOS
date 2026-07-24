"use client";

import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  ChevronsUpDown,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  User,
  CheckCheck,
  AlertTriangle,
  CircleCheck,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ThemeToggle } from "@/components/theme-toggle";
import { StatusPill } from "./status-pill";
import { cn } from "@/lib/utils";
import { initials, relativeTime } from "@/lib/format";
import { DEMO_USER, ORGS } from "@/lib/mock/user";
import { NOTIFICATIONS } from "@/lib/mock/insights";

const NOTIF_ICON = {
  warning: AlertTriangle,
  success: CircleCheck,
  info: Info,
};
const NOTIF_COLOR = {
  warning: "text-warning",
  success: "text-success",
  info: "text-info",
};

export function Topbar({
  onMenuClick,
  onSearchClick,
}: {
  onMenuClick: () => void;
  onSearchClick: () => void;
}) {
  const router = useRouter();
  const unread = NOTIFICATIONS.filter((n) => !n.read).length;

  function signOut() {
    if (typeof window !== "undefined") localStorage.removeItem("pso_authed");
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-lg">
      <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={onMenuClick}>
        <Menu />
      </Button>

      {/* Org switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm transition-colors hover:bg-secondary">
            <span className="flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-primary to-chart-6 text-[10px] font-bold text-white">
              {initials(DEMO_USER.org)}
            </span>
            <span className="hidden max-w-[140px] truncate font-medium sm:inline">
              {DEMO_USER.org}
            </span>
            <ChevronsUpDown className="size-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          {ORGS.map((o) => (
            <DropdownMenuItem key={o.id} className="gap-2">
              <span className="flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-primary to-chart-6 text-[10px] font-bold text-white">
                {initials(o.name)}
              </span>
              <span className="flex-1 truncate">{o.name}</span>
              {o.name === DEMO_USER.org && <Check className="size-4 text-primary" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2 text-muted-foreground">
            <Plus className="size-4" /> Create workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Search */}
      <button
        onClick={onSearchClick}
        className="ml-auto flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary sm:w-72"
      >
        <Search className="size-4" />
        <span className="hidden flex-1 text-left sm:inline">Search…</span>
        <kbd className="hidden rounded border border-border bg-background px-1.5 py-0.5 text-[10px] sm:inline">
          ⌘K
        </kbd>
      </button>

      <ThemeToggle />

      {/* Notifications */}
      <Popover>
        <PopoverTrigger asChild>
          <button className="relative flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
            <Bell className="size-4" />
            {unread > 0 && (
              <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-danger text-[9px] font-bold text-white">
                {unread}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-sm font-semibold">Notifications</span>
            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <CheckCheck className="size-3.5" /> Mark all read
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {NOTIFICATIONS.map((n) => {
              const Icon = NOTIF_ICON[n.type];
              return (
                <div
                  key={n.id}
                  className={cn(
                    "flex gap-3 border-b border-border/60 px-4 py-3 transition-colors last:border-0 hover:bg-secondary/50",
                    !n.read && "bg-primary/[0.03]"
                  )}
                >
                  <Icon className={cn("mt-0.5 size-4 shrink-0", NOTIF_COLOR[n.type])} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground">{n.detail}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {relativeTime(n.at)}
                    </p>
                  </div>
                  {!n.read && <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />}
                </div>
              );
            })}
          </div>
          <div className="border-t border-border p-2">
            <Button variant="ghost" size="sm" className="w-full">
              View all notifications
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-full outline-none">
            <Avatar className="size-8">
              <AvatarFallback>{initials(DEMO_USER.name)}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Avatar className="size-9">
              <AvatarFallback>{initials(DEMO_USER.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{DEMO_USER.name}</p>
              <p className="truncate text-xs text-muted-foreground">{DEMO_USER.email}</p>
            </div>
          </div>
          <div className="px-2 pb-1.5">
            <StatusPill label={`${DEMO_USER.role} · ${DEMO_USER.plan}`} variant="default" />
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2">
            <User className="size-4" /> Profile
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2">
            <Settings className="size-4" /> Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="danger" className="gap-2" onSelect={signOut}>
            <LogOut className="size-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
