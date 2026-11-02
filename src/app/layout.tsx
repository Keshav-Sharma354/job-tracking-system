import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { getEnv } from "@/lib/env";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "Job Search CRM",
    template: "%s · Job Search CRM",
  },
  description:
    "Track applications, contacts, outreach and follow-ups for your entire job search.",
  applicationName: "Job Search CRM",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfd" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1d21" },
  ],
  width: "device-width",
  initialScale: 1,
};

/**
 * Applies the stored theme before first paint.
 *
 * This has to be a blocking inline script: any React-level solution runs after
 * hydration, which would show a flash of the wrong theme on every navigation.
 */
const themeScript = `(function(){try{var t=localStorage.getItem('jts-theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var d=t==='dark'||(t!=='light'&&m);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Read once so a misconfigured environment fails loudly at boot rather than
  // on the first request that happens to touch the database.
  getEnv();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      {/* suppressHydrationWarning: browser extensions (Grammarly and friends)
          inject attributes such as data-gr-ext-installed onto <body> before
          React hydrates, which is not a divergence in our own markup. Scoped to
          this element's attributes only, so it cannot mask mismatches deeper in
          the tree. */}
      <body
        suppressHydrationWarning
        className={`${inter.variable} min-h-dvh bg-background font-sans text-foreground antialiased`}
      >
        <ThemeProvider>
          <TooltipProvider>
            {children}
            <Toaster
              position="bottom-right"
              closeButton
              toastOptions={{
                classNames: {
                  toast:
                    "!rounded-xl !border-border !bg-surface-raised !text-foreground !shadow-lg",
                  description: "!text-muted",
                },
              }}
            />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
