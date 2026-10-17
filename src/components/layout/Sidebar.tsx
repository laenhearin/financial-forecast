"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleUser, Menu, X } from "lucide-react";
import { APP_NAME, USER_NAME } from "@/lib/config";
import { getActiveHref, NAV_ITEMS } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";

/*
 * Layout by width: 1024px+ full sidebar; 768–1023px a 64px icon rail (md:max-lg:) whose labels
 * turn into hover/focus tooltips but stay readable to screen readers; under 768px (max-md:) a top
 * bar whose menu button opens the same sidebar as a slide-in drawer.
 */
const iconButton =
  "ui-transition inline-flex size-8 shrink-0 items-center justify-center rounded-item text-secondary hover:bg-nav-hover hover:text-primary";

const railTooltip =
  "md:max-lg:pointer-events-none md:max-lg:absolute md:max-lg:top-1/2 md:max-lg:left-full md:max-lg:ml-4 md:max-lg:-translate-y-1/2 md:max-lg:rounded-item md:max-lg:border md:max-lg:border-app md:max-lg:bg-card md:max-lg:px-2.5 md:max-lg:py-1 md:max-lg:text-primary md:max-lg:opacity-0 md:max-lg:group-hover:opacity-100 md:max-lg:group-focus-visible:opacity-100";

function LogoMark() {
  return <span aria-hidden className="size-6 shrink-0 rounded-logo bg-logo" />;
}

export function Sidebar() {
  const pathname = usePathname();
  const activeHref = getActiveHref(pathname);
  // The drawer is open only on the page where it was opened, so any navigation closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);

  const closeDrawer = (returnFocus: boolean) => {
    setOpenOn(null);
    if (returnFocus) menuButtonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    navRef.current?.querySelector("a")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenOn(null);
      menuButtonRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <div className="sticky top-0 z-30 flex h-14 items-center gap-2.5 border-b border-app bg-sidebar px-4 md:hidden">
        <LogoMark />
        <span className="truncate text-lead font-medium text-primary">{APP_NAME}</span>
        <button
          ref={menuButtonRef}
          type="button"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="app-sidebar"
          onClick={() => setOpenOn(pathname)}
          className={cn(iconButton, "ml-auto size-10")}
        >
          <Menu aria-hidden className="size-5" strokeWidth={1.75} />
        </button>
      </div>

      {open && <div aria-hidden className="fixed inset-0 z-40 bg-scrim md:hidden" onClick={() => closeDrawer(true)} />}

      <aside
        id="app-sidebar"
        data-open={open || undefined}
        className={cn(
          "flex w-(--sidebar-width) shrink-0 flex-col border-r border-app bg-sidebar px-3 py-6",
          "max-md:invisible max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:-translate-x-full max-md:overflow-y-auto",
          // Visible at once when opening (so focus can move in); hidden only after the slide-out.
          "max-md:motion-safe:[transition:translate_150ms_ease-out,visibility_0s_linear_150ms]",
          "max-md:data-open:visible max-md:data-open:translate-x-0 max-md:data-open:motion-safe:[transition:translate_150ms_ease-out]",
          "md:sticky md:top-0 md:z-20 md:h-screen",
        )}
      >
        <div className="mb-7 flex items-center gap-2.5 px-2.5 md:max-lg:justify-center md:max-lg:px-0">
          <LogoMark />
          <span className="truncate text-lead font-medium text-primary md:max-lg:sr-only">{APP_NAME}</span>
          <button type="button" aria-label="Close menu" onClick={() => closeDrawer(true)} className={cn(iconButton, "ml-auto md:hidden")}>
            <X aria-hidden className="size-4.5" strokeWidth={1.75} />
          </button>
        </div>

        <nav ref={navRef} aria-label="Main">
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
              const active = href === activeHref;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => closeDrawer(false)}
                    className={cn(
                      "ui-transition group relative flex h-10 items-center gap-3 rounded-item px-3 text-body md:max-lg:justify-center md:max-lg:px-0",
                      active ? "bg-nav-active font-medium text-accent" : "text-secondary hover:bg-nav-hover hover:text-primary",
                    )}
                  >
                    <Icon aria-hidden className="size-4.5 shrink-0" strokeWidth={1.75} />
                    <span className={cn("truncate md:max-lg:overflow-visible", railTooltip)}>{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-auto flex items-center gap-3 pt-6 pl-2.5 md:max-lg:flex-col md:max-lg:pl-0">
          <CircleUser aria-hidden className="size-5 shrink-0 text-secondary" strokeWidth={1.75} />
          <span className="truncate text-body text-secondary md:max-lg:sr-only">{USER_NAME}</span>
          <ThemeToggle className="ml-auto md:max-lg:ml-0" />
        </div>
      </aside>
    </>
  );
}
