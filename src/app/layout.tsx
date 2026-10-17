import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { Sidebar } from "@/components/layout/Sidebar";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = { title: "Financial Forecast", description: "Your money, a little clearer." };

/** The shared shell: every page renders inside <main>, next to the one Sidebar. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // next-themes sets data-theme on <html> before hydration.
    <html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col bg-app text-primary antialiased md:flex-row">
        <ThemeProvider>
          <Sidebar />
          <main className="min-h-screen min-w-0 flex-1">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
