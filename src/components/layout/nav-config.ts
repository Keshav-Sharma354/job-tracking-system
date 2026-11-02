import {
  BarChart3,
  Building2,
  CalendarCheck,
  KanbanSquare,
  LayoutDashboard,
  Mail,
  NotebookPen,
  Search,
  Settings,
  Users,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Longer paths that should also highlight this entry. */
  matchPrefix?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
      },
      {
        href: "/tasks",
        label: "Follow-ups",
        icon: CalendarCheck,
        matchPrefix: "/tasks",
      },
    ],
  },
  {
    title: "Pipeline",
    items: [
      { href: "/jobs", label: "Applications", icon: Building2, matchPrefix: "/jobs" },
      {
        href: "/jobs/board",
        label: "Kanban board",
        icon: KanbanSquare,
        matchPrefix: "/jobs/board",
      },
      { href: "/contacts", label: "Contacts", icon: Users, matchPrefix: "/contacts" },
      {
        href: "/companies",
        label: "Companies",
        icon: Building2,
        matchPrefix: "/companies",
      },
    ],
  },
  {
    title: "Outreach",
    items: [
      { href: "/emails", label: "Outreach", icon: Mail, matchPrefix: "/emails" },
      {
        href: "/templates",
        label: "Templates",
        icon: NotebookPen,
        matchPrefix: "/templates",
      },
    ],
  },
  {
    title: "Insights",
    items: [
      { href: "/notes", label: "Notes", icon: NotebookPen, matchPrefix: "/notes" },
      { href: "/reports", label: "Reports", icon: BarChart3, matchPrefix: "/reports" },
    ],
  },
];

export const SETTINGS_NAV: NavItem = {
  href: "/settings",
  label: "Settings",
  icon: Settings,
};

export const SEARCH_NAV: NavItem = {
  href: "/search",
  label: "Search",
  icon: Search,
};

/** True when `pathname` should render `item` as the active entry. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (pathname === item.href) return true;
  if (item.matchPrefix && pathname.startsWith(`${item.matchPrefix}/`)) {
    return true;
  }
  return false;
}
