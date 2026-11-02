"use client";

import * as React from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "jts-theme";

/**
 * Notifies subscribers when the theme changes outside React — for example when
 * the user picks a theme in another tab, or when the pre-paint script applies a
 * stored preference.
 */
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) listener();
}

/** Keeps multiple open tabs in step. */
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) emitChange();
  });
}

function readTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

/**
 * Theme state backed by `useSyncExternalStore`.
 *
 * The blocking script in the root layout has already set the `dark` class before
 * React hydrates, so the DOM is the source of truth. Reading it through
 * `useSyncExternalStore` means there is no effect-driven state to synchronise
 * and therefore no cascading render — and no flash of the wrong theme.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = React.useSyncExternalStore(
    subscribe,
    readTheme,
    // On the server there is no DOM, so assume light. The blocking script in the
    // layout corrects this before first paint.
    (): Theme => "light",
  );

  const setTheme = React.useCallback((next: Theme) => {
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.style.colorScheme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing modes can reject writes; the choice simply will not
      // persist, which is acceptable.
    }
    emitChange();
  }, []);

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggle: () => setTheme(theme === "dark" ? "light" : "dark"),
    }),
    [theme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return ctx;
}
