"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { CircleUser, Menu, X } from "lucide-react";
import { Tooltip } from "@base-ui/react/tooltip";
import { APP_NAME } from "@/lib/config";
import { getActiveHref, NAV_ITEMS, ROUTES } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { NimbusMascot } from "@/features/nimbus/components/NimbusMascot";
import { useActiveCustomer } from "./ActiveCustomer";
import { ThemeToggle } from "./ThemeToggle";

/*
 * Layout by width: 1024px+ full sidebar; 768–1023px a 64px icon rail (md:max-lg:) whose labels
 * stay readable to screen readers and appear in the feature tooltips; under 768px (max-md:) a top
 * bar whose menu button opens the same sidebar as a slide-in drawer.
 */
const iconButton =
  "ui-transition inline-flex size-8 shrink-0 items-center justify-center rounded-item text-secondary hover:bg-nav-hover hover:text-primary";

const FEATURE_TOOLTIP_DELAY_MS = 1000;

function LogoMark({ className }: { className?: string }) {
  return <Image src="/icon.png" alt="" width={128} height={128} className={cn("size-8 shrink-0 rounded-logo object-cover", className)} />;
}

export function Sidebar() {
  const profileName = useActiveCustomer()?.name ?? "No Nessie customer";
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
        <div className="mb-10 flex items-center gap-3 px-1 md:max-lg:mb-7 md:max-lg:justify-center md:max-lg:px-0">
          <LogoMark className="size-16 md:max-lg:size-10" />
          <span className="text-2xl leading-tight font-semibold tracking-tight text-primary md:max-lg:sr-only">{APP_NAME}</span>
          <button type="button" aria-label="Close menu" onClick={() => closeDrawer(true)} className={cn(iconButton, "ml-auto md:hidden")}>
            <X aria-hidden className="size-4.5" strokeWidth={1.75} />
          </button>
        </div>

        <nav ref={navRef} aria-label="Main">
          <p className="mb-2 px-3 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-secondary md:max-lg:sr-only">Workspace</p>
          <ul className="flex flex-col gap-3">
            {NAV_ITEMS.map(({ label, description, href, icon: Icon }) => {
              const active = href === activeHref;
              const tooltipId = `nav-tooltip-${href === "/" ? "home" : href.slice(1)}`;
              return (
                <li key={href}>
                  {/* Independent roots keep the full hover delay when moving between links. */}
                  <Tooltip.Root>
                    <Tooltip.Trigger
                      delay={FEATURE_TOOLTIP_DELAY_MS}
                      render={(props, state) => <Link {...props} href={href} aria-describedby={state.open ? tooltipId : undefined} />}
                      aria-current={active ? "page" : undefined}
                      onClick={() => closeDrawer(false)}
                      className={cn(
                        "ui-transition relative flex h-12 items-center gap-3 rounded-item px-3 text-body md:max-lg:justify-center md:max-lg:px-0",
                        active ? "bg-nav-active font-medium text-accent" : "text-secondary hover:bg-nav-hover hover:text-primary",
                      )}
                    >
                      <Icon aria-hidden className="size-4.5 shrink-0" strokeWidth={1.75} />
                      <span className="truncate md:max-lg:sr-only">{label}</span>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Positioner side="right" sideOffset={16} collisionPadding={12} className="z-60">
                        <Tooltip.Popup id={tooltipId} role="tooltip" className="w-64 max-w-[calc(100vw-2rem)] rounded-panel border border-app bg-(--weather-card-solid) p-4 text-caption leading-relaxed text-secondary shadow-lg outline-none motion-safe:transition-[opacity,transform] motion-safe:duration-150 data-starting-style:translate-x-1 data-starting-style:opacity-0 data-ending-style:opacity-0">
                          <span className="mb-1.5 block text-body font-medium text-primary">{label}</span>
                          {description}
                        </Tooltip.Popup>
                      </Tooltip.Positioner>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Desktop only. Its auto top margin is the spacer that keeps Nimbus just above the settings block. */}
        <NimbusMascot className="mt-auto hidden pb-6 lg:flex" />

        <div className="mt-auto border-t border-app pt-5 lg:mt-0">
          {/* The current profile is the way into Profile & settings. */}
          <div className="flex items-center gap-2 md:max-lg:flex-col">
            <Link
              href={ROUTES.profile}
              title={`${profileName} · Profile & settings`}
              aria-current={pathname === ROUTES.profile ? "page" : undefined}
              onClick={() => closeDrawer(false)}
              className={cn(
                "ui-transition flex min-w-0 flex-1 items-center gap-2.5 rounded-panel p-2 md:max-lg:w-full md:max-lg:flex-none md:max-lg:justify-center md:max-lg:p-1",
                pathname === ROUTES.profile ? "bg-nav-active text-accent" : "bg-app text-primary hover:bg-nav-hover",
              )}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                <CircleUser aria-hidden className="size-5" strokeWidth={1.75} />
              </span>
              <span className="truncate text-caption font-semibold md:max-lg:sr-only">
                <span className="sr-only">Profile and settings: </span>
                {profileName}
              </span>
            </Link>
            <ThemeToggle className="size-10 shrink-0 md:max-lg:size-8" />
          </div>
        </div>
      </aside>
    </>
  );
}
