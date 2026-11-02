"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun, Target } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { IconTooltip } from "@/components/ui/tooltip";
import { useTheme } from "@/components/layout/theme-provider";
import { GlobalSearch } from "@/components/layout/global-search";
import { UserMenu } from "@/components/layout/user-menu";
import { NAV_SECTIONS, SEARCH_NAV, SETTINGS_NAV, isNavItemActive } from "./nav-config";

export function AppShell({
  children,
  userName,
  userEmail,
  openTaskCount,
}: {
  children: React.ReactNode;
  userName: string;
  userEmail: string;
  openTaskCount: number;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh bg-background">
      {/* Sidebar: static on desktop, a slide-over on small screens. */}
      <Sidebar pathname={pathname} openTaskCount={openTaskCount} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <MobileNavTrigger />
            <GlobalSearch />
            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle />
              <UserMenu name={userName} email={userEmail} />
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

function Sidebar({
  pathname,
  openTaskCount,
}: {
  pathname: string;
  openTaskCount: number;
}) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface-sunken lg:flex">
      <div className="flex h-14 items-center gap-2 px-4">
        <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Target className="size-4" strokeWidth={2.5} />
        </span>
        <span className="text-sm font-semibold tracking-tight text-foreground">
          Job Search CRM
        </span>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4 pt-2">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="px-2 pb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-subtle">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.href}>
                  <NavLink
                    item={item}
                    active={isNavItemActive(item, pathname)}
                    badge={item.href === "/tasks" && openTaskCount > 0 ? openTaskCount : undefined}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <NavLink item={SEARCH_NAV} active={isNavItemActive(SEARCH_NAV, pathname)} />
        <NavLink item={SETTINGS_NAV} active={isNavItemActive(SETTINGS_NAV, pathname)} />
      </div>
    </aside>
  );
}

function NavLink({
  item,
  active,
  badge,
}: {
  item: { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
  active: boolean;
  badge?: number;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-surface text-foreground shadow-sm ring-1 ring-border"
          : "text-muted hover:bg-surface-hover hover:text-foreground",
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0 transition-colors",
          active ? "text-accent" : "text-subtle group-hover:text-muted",
        )}
      />
      <span className="flex-1 truncate">{item.label}</span>
      {badge !== undefined ? (
        <span className="rounded-full bg-accent-subtle px-1.5 py-0.5 text-[0.6875rem] font-semibold text-accent tabular-nums">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

/** The sidebar collapses to a slide-over below the `lg` breakpoint. */
function MobileNavTrigger() {
  return (
    <details className="group relative lg:hidden">
      <summary
        className="flex size-9 cursor-pointer list-none items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-foreground [&::-webkit-details-marker]:hidden"
        aria-label="Open navigation"
      >
        <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M3 6h14M3 10h14M3 14h14" strokeLinecap="round" />
        </svg>
      </summary>
      <div className="fixed inset-0 z-40 bg-black/45" />
      <nav className="fixed inset-y-0 left-0 z-50 w-64 overflow-y-auto border-r border-border bg-surface p-3 shadow-xl">
        <p className="px-2 pb-3 text-sm font-semibold">Job Search CRM</p>
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-4">
            <p className="px-2 pb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-subtle">
              {section.title}
            </p>
            {section.items.map((item) => (
              <NavLink key={item.href} item={item} active={isNavItemActive(item, pathnameSafe())} />
            ))}
          </div>
        ))}
        <div className="border-t border-border pt-2">
          <NavLink item={SEARCH_NAV} active={isNavItemActive(SEARCH_NAV, pathnameSafe())} />
          <NavLink item={SETTINGS_NAV} active={isNavItemActive(SETTINGS_NAV, pathnameSafe())} />
        </div>
      </nav>
    </details>
  );
}

/** `usePathname` cannot be called conditionally inside `<details>`. */
function pathnameSafe(): string {
  return typeof window === "undefined" ? "" : window.location.pathname;
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <IconTooltip label={isDark ? "Switch to light" : "Switch to dark"}>
      <Button
        variant="ghost"
        size="icon"
        onClick={toggle}
        aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      >
        {/* Both icons are rendered and cross-faded so the control never shifts
            size between themes. */}
        <Sun className="size-4 dark:hidden" />
        <Moon className="hidden size-4 dark:block" />
      </Button>
    </IconTooltip>
  );
}
