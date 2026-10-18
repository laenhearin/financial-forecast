"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useActiveCustomer } from "@/components/layout/ActiveCustomer";
import { cn } from "@/lib/utils";
import { NIMBUS_SIZE, POPUP } from "../config";
import { useNimbusBehavior } from "../hooks/useNimbusBehavior";
import { useNimbusChat } from "../hooks/useNimbusChat";
import { useReduceMotion } from "../hooks/useReduceMotion";
import { NimbusChatPopup, type PopupPlacement } from "./NimbusChatPopup";
import { NimbusSvg } from "./NimbusSvg";
import styles from "./nimbus.module.css";

const POPUP_ID = "nimbus-chat";

/** Right of the sidebar, bottom-aligned with Nimbus's region, kept inside the window. */
function placePopup(region: HTMLElement): PopupPlacement {
  const anchor = region.getBoundingClientRect();
  const sidebarRight = region.closest("aside")?.getBoundingClientRect().right ?? anchor.right;
  const bottom = Math.max(POPUP.edgePx, window.innerHeight - anchor.bottom);
  return { left: sidebarRight + POPUP.gapPx, bottom, maxHeight: Math.min(POPUP.maxHeight, window.innerHeight - bottom - POPUP.edgePx) };
}

/**
 * Nimbus, the sidebar cloud. Mounted once in the shared sidebar, so it is on every page; the
 * caller hides it below the lg breakpoint. Clicking plays a reaction and toggles the chat.
 */
export function NimbusMascot({ size = NIMBUS_SIZE.default, className }: { size?: number; className?: string }) {
  const customerId = useActiveCustomer()?.id ?? null;
  const { reduceMotion } = useReduceMotion();
  const chat = useNimbusChat(customerId);
  const regionRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const behavior = useNimbusBehavior({ targetRef: buttonRef, boundsRef: regionRef, thinking: chat.isLoading, reduceMotion });
  const [placement, setPlacement] = useState<PopupPlacement | null>(null);
  const open = placement !== null;
  const width = Math.min(NIMBUS_SIZE.max, Math.max(NIMBUS_SIZE.min, size));

  useEffect(() => {
    if (!open) return;
    const onResize = () => {
      if (regionRef.current) setPlacement(placePopup(regionRef.current));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open]);

  function toggle() {
    behavior.react();
    if (open) setPlacement(null);
    else if (regionRef.current) setPlacement(placePopup(regionRef.current));
  }

  function close() {
    setPlacement(null);
    buttonRef.current?.focus();
  }

  const wanderStyle = { "--nimbus-wander-x": `${behavior.wanderX}px`, "--nimbus-wander-dir": behavior.wanderX < 0 ? -1 : 1 } as CSSProperties;

  return (
    <div ref={regionRef} className={cn("flex justify-center pt-4", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Chat with Nimbus"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? POPUP_ID : undefined}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) close();
        }}
        data-action={behavior.action}
        className={styles.button}
        style={wanderStyle}
      >
        <NimbusSvg mood={behavior.mood} action={behavior.action} look={behavior.look} blink={behavior.blink} size={width} reduceMotion={reduceMotion} />
      </button>
      {placement && <NimbusChatPopup id={POPUP_ID} placement={placement} chat={chat} reduceMotion={reduceMotion} onClose={close} />}
    </div>
  );
}
