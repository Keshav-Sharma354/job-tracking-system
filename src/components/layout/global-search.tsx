"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { globalSearchAction, type GlobalSearchPayload } from "@/app/actions/search";

/**
 * Header search across every entity.
 *
 * Implemented with a `role="combobox"` listbox rather than a popover library so
 * keyboard support (arrows, Enter, Escape) is explicit and screen readers get
 * the right semantics for free.
 */
export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<GlobalSearchPayload | null>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  // Guards against an out-of-order response overwriting a newer one.
  const requestId = React.useRef(0);

  // Flattened navigation list so arrow keys move through every group in order.
  const flat = React.useMemo(() => {
    if (!results) return [];
    const groups: { key: string; label: string; items: GlobalSearchPayload["jobs"] }[] = [
      { key: "jobs", label: "Applications", items: results.jobs },
      { key: "contacts", label: "Contacts", items: results.contacts },
      { key: "companies", label: "Companies", items: results.companies },
      { key: "notes", label: "Notes", items: results.notes },
      { key: "emails", label: "Emails", items: results.emails },
      { key: "tasks", label: "Tasks", items: results.tasks },
    ];
    return groups
      .filter((g) => g.items.length > 0)
      .flatMap((g) => g.items.map((item) => ({ ...item, group: g.label })));
  }, [results]);

  React.useEffect(() => {
    const trimmed = query.trim();

    // Too short to search. The panel is hidden by `showPanel` regardless, so
    // there is nothing to reset here — avoiding a setState in the effect body.
    if (trimmed.length < 2) return;

    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const payload = await globalSearchAction(trimmed);
        // Ignore a response that a newer keystroke has already superseded.
        if (id === requestId.current) {
          setResults(payload);
          setActiveIndex(0);
        }
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [query]);

  React.useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  // Cmd/Ctrl+K focuses the field from anywhere.
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function go(item: { href: string }) {
    setOpen(false);
    setQuery("");
    router.push(item.href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (flat.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % flat.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + flat.length) % flat.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = flat[activeIndex];
      if (item) go(item);
    }
  }

  const showPanel = open && query.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1 sm:max-w-md">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle"
        />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="global-search-results"
          aria-autocomplete="list"
          aria-label="Search applications, contacts and notes"
          placeholder="Search everything…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={cn(
            "h-9 w-full rounded-lg border border-input bg-surface-sunken pl-8 pr-16 text-sm text-foreground",
            "transition-colors placeholder:text-subtle",
            "focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "[&::-webkit-search-cancel-button]:appearance-none",
          )}
        />
        <div className="pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
          {loading ? <Loader2 className="size-3.5 animate-spin text-subtle" /> : null}
          <kbd className="hidden rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[0.625rem] text-subtle sm:block">
            ⌘K
          </kbd>
        </div>
      </div>

      {showPanel ? (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-[26rem] overflow-y-auto rounded-xl border border-border bg-surface-raised p-1.5 shadow-xl"
        >
          {flat.length === 0 && !loading ? (
            <p className="px-3 py-6 text-center text-sm text-muted">
              No matches for “{query.trim()}”.
            </p>
          ) : null}

          {flat.length > 0 ? (
            <>
              {Object.entries(
                flat.reduce<Record<string, typeof flat>>((acc, item) => {
                  (acc[item.group] ??= []).push(item);
                  return acc;
                }, {}),
              ).map(([group, items]) => (
                <div key={group} className="mb-1 last:mb-0">
                  <p className="px-2 pb-1 pt-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-subtle">
                    {group}
                  </p>
                  {items.map((item) => {
                    const index = flat.indexOf(item);
                    return (
                      <button
                        key={`${group}-${item.id}`}
                        type="button"
                        role="option"
                        aria-selected={index === activeIndex}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => go(item)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                          index === activeIndex
                            ? "bg-surface-hover text-foreground"
                            : "text-muted",
                        )}
                      >
                        <span className="truncate font-medium text-foreground">
                          {item.title}
                        </span>
                        {item.subtitle ? (
                          <span className="truncate text-xs text-subtle">
                            {item.subtitle}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))}
            </>
          ) : null}

          <button
            type="button"
            onClick={() => go({ href: `/search?q=${encodeURIComponent(query.trim())}` })}
            className="mt-1 flex w-full items-center justify-between rounded-md border-t border-border px-2 py-2 text-xs text-muted transition-colors hover:bg-surface-hover"
          >
            <span>See all results for “{query.trim()}”</span>
            <span className="font-mono">↵</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
