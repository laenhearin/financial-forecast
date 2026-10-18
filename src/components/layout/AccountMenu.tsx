"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, CircleUser, Settings2, WalletCards } from "lucide-react";
import { ROUTES } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { useActiveCustomer } from "./ActiveCustomer";
import { ReduceMotionSwitch } from "./ReduceMotionSwitch";
import { ThemeToggle } from "./ThemeToggle";

type Panel = "settings" | null;
export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const profileName = useActiveCustomer()?.name ?? "No Nessie customer";
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setPanel(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setPanel(null);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function close() {
    setOpen(false);
    setPanel(null);
  }

  return (
    <div ref={rootRef} className="fixed right-4 top-3 z-50 md:top-4 max-md:right-16">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Open profile, settings, and accounts menu"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen((value) => !value);
          setPanel(null);
        }}
        className="ui-transition inline-flex h-10 items-center gap-2 rounded-full border border-app bg-card px-3 text-primary shadow-sm hover:border-accent-line"
      >
        <CircleUser aria-hidden className="size-5 text-accent" strokeWidth={1.75} />
        <span className="hidden max-w-36 truncate text-caption font-medium sm:inline">{profileName}</span>
        <ChevronDown aria-hidden className={cn("size-4 text-secondary transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <section
          role="dialog"
          aria-label="Profile, settings, and accounts"
          className="absolute right-0 top-12 w-72 overflow-hidden rounded-panel border border-app bg-card p-2 shadow-xl"
        >
          {panel ? (
            <>
              <div className="mt-2 flex items-center justify-between gap-3 rounded-item bg-app p-3">
                <div>
                  <p className="text-caption font-semibold text-primary">Appearance</p>
                  <p className="mt-1 text-micro text-secondary">Switch between Clear Skies and Heavy Rain.</p>
                </div>
                <ThemeToggle className="size-9 bg-card" />
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 rounded-item bg-app p-3">
                <div>
                  <p id="reduce-motion-label" className="text-caption font-semibold text-primary">Reduce motion</p>
                  <p id="reduce-motion-hint" className="mt-1 text-micro text-secondary">Calms Nimbus, the sidebar cloud.</p>
                </div>
                <ReduceMotionSwitch labelledBy="reduce-motion-label" describedBy="reduce-motion-hint" />
              </div>
            </>
          ) : (
            <nav aria-label="Account menu" className="flex flex-col gap-1">
              <Link href={ROUTES.profile} onClick={close} className="ui-transition flex items-center gap-3 rounded-item px-3 py-2.5 hover:bg-nav-hover">
                <CircleUser aria-hidden className="size-4.5 text-secondary" />
                <span className="min-w-0 flex-1">
                  <span className="block text-caption font-medium text-primary">Profile</span>
                  <span className="block truncate text-micro text-secondary">{profileName}</span>
                </span>
              </Link>
              <button type="button" onClick={() => setPanel("settings")} className="ui-transition flex items-center gap-3 rounded-item px-3 py-2.5 text-left hover:bg-nav-hover">
                <Settings2 aria-hidden className="size-4.5 text-secondary" />
                <span className="min-w-0 flex-1">
                  <span className="block text-caption font-medium text-primary">Settings</span>
                  <span className="block text-micro text-secondary">Appearance and preferences</span>
                </span>
              </button>
              <Link href={ROUTES.calendar} onClick={close} className="ui-transition flex items-center gap-3 rounded-item px-3 py-2.5 hover:bg-nav-hover">
                <WalletCards aria-hidden className="size-4.5 text-secondary" />
                <span className="min-w-0 flex-1">
                  <span className="block text-caption font-medium text-primary">Accounts</span>
                  <span className="block text-micro text-secondary">View account calendars</span>
                </span>
              </Link>
            </nav>
          )}
        </section>
      )}
    </div>
  );
}
