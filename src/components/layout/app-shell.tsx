"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun, Target, X } from "lucide-react";
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
            <MobileNavDrawer pathname={pathname} openTaskCount={openTaskCount} />
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
function MobileNavDrawer({
  pathname,
  openTaskCount,
}: {
  pathname: string;
  openTaskCount: number;
}) {
  const [open, setOpen] = React.useState(false);

  // Close on route change
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Handle escape key
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Lock body scroll when mobile nav is open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
        aria-label="Open navigation"
        aria-expanded={open}
      >
        <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M3 6h14M3 10h14M3 14h14" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex">
          {/* Backdrop with click-to-close */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer container with scrolling */}
          <nav
            className="relative z-50 flex h-full w-72 max-w-[calc(100vw-3rem)] flex-col border-r border-border bg-surface p-4 shadow-2xl"
            aria-label="Mobile navigation"
          >
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Target className="size-4" strokeWidth={2.5} />
                </span>
                <span className="text-sm font-semibold tracking-tight text-foreground">
                  Job Search CRM
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                aria-label="Close navigation"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain pr-1">
              {NAV_SECTIONS.map((section) => (
                <div key={section.title}>
                  <p className="px-2 pb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-subtle">
                    {section.title}
                  </p>
                  <ul className="space-y-0.5">
                    {section.items.map((item) => (
                      <li key={item.href} onClick={() => setOpen(false)}>
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
            </div>

            <div className="border-t border-border pt-3">
              <div onClick={() => setOpen(false)}>
                <NavLink item={SEARCH_NAV} active={isNavItemActive(SEARCH_NAV, pathname)} />
              </div>
              <div onClick={() => setOpen(false)}>
                <NavLink item={SETTINGS_NAV} active={isNavItemActive(SETTINGS_NAV, pathname)} />
              </div>
            </div>
          </nav>
        </div>
      )}
    </div>
  );
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
