"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  BLINK, CLICK_REACTION_MS, EXCITE_RADIUS_PX, EXCITE_RELEASE_MS, IDLE_ACTIONS, IDLE_DELAY_MS,
  LOOK_RADIUS_PX, NIMBUS_MAX_LOOK, NO_LOOK, THINKING_LOOK, WANDER_REACH,
} from "../config";
import { pickAction } from "../engine/pickAction";
import type { IdleAction, NimbusAction, NimbusLook, NimbusMood } from "../types";

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Half-unit steps, so a moving cursor re-renders Nimbus a few times rather than every frame. */
function quantize(value: number): number {
  return Math.round(value * 2) / 2 || 0;
}

/** Pupils point at the cursor, easing off when it is right on top of Nimbus. */
function lookToward(dx: number, dy: number, distance: number): NimbusLook {
  if (distance === 0) return NO_LOOK;
  const reach = NIMBUS_MAX_LOOK * Math.min(1, distance / 60);
  return { x: quantize((dx / distance) * reach), y: quantize((dy / distance) * reach) };
}

/** A signed horizontal offset that keeps Nimbus inside `bounds` (the sidebar's inner width). */
function wanderOffset(target: HTMLElement | null, bounds: HTMLElement | null): number {
  if (!target || !bounds) return 0;
  const self = target.getBoundingClientRect();
  const area = bounds.getBoundingClientRect();
  const direction = Math.random() < 0.5 ? -1 : 1;
  const room = Math.max(0, direction < 0 ? self.left - area.left : area.right - self.right);
  return Math.round(direction * room * randomBetween(WANDER_REACH.min, WANDER_REACH.max));
}

/** Blinks every few seconds (sometimes twice) while enabled. */
export function useBlink(enabled: boolean): boolean {
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let timer = 0;
    const blink = (twice: boolean) => {
      setClosed(true);
      timer = window.setTimeout(() => {
        setClosed(false);
        timer = twice ? window.setTimeout(() => blink(false), BLINK.doubleGapMs) : wait();
      }, BLINK.durationMs);
    };
    const wait = () => window.setTimeout(() => blink(Math.random() < BLINK.doubleChance), randomBetween(BLINK.minDelayMs, BLINK.maxDelayMs));
    timer = wait();
    return () => {
      window.clearTimeout(timer);
      setClosed(false);
    };
  }, [enabled]);
  return enabled && closed;
}

interface BehaviorOptions {
  /** The clickable Nimbus; cursor distance is measured from its center. */
  targetRef: RefObject<HTMLElement | null>;
  /** The area Nimbus may wander across. */
  boundsRef: RefObject<HTMLElement | null>;
  /** A chat request is in flight. */
  thinking: boolean;
  reduceMotion: boolean;
}

/**
 * Nimbus's mood, current action and pupil offset. Priority: thinking, then excited (cursor near),
 * then the click reaction (which plays over excited, since a click always happens up close), then
 * a scheduled idle action, then happy. With reduce motion only the face changes.
 */
export function useNimbusBehavior({ targetRef, boundsRef, thinking, reduceMotion }: BehaviorOptions) {
  const [idle, setIdle] = useState<IdleAction | null>(null);
  const [wanderX, setWanderX] = useState(0);
  const [near, setNear] = useState(false);
  const [clicking, setClicking] = useState(false);
  const [cursorLook, setCursorLook] = useState<NimbusLook>(NO_LOOK);
  const blink = useBlink(!reduceMotion);
  const previous = useRef<IdleAction | null>(null);
  const clickTimer = useRef(0);

  // Idle scheduler: wait 4 to 8 s, play one action, return to happy, repeat. Paused while thinking or excited.
  const paused = thinking || near || reduceMotion;
  useEffect(() => {
    if (paused) return;
    let timer = 0;
    const play = () => {
      const action = pickAction(previous.current);
      previous.current = action;
      if (action === "wander") setWanderX(wanderOffset(targetRef.current, boundsRef.current));
      setIdle(action);
      timer = window.setTimeout(() => {
        setIdle(null);
        timer = wait();
      }, IDLE_ACTIONS[action].durationMs);
    };
    const wait = () => window.setTimeout(play, randomBetween(IDLE_DELAY_MS.min, IDLE_DELAY_MS.max));
    timer = wait();
    return () => {
      window.clearTimeout(timer);
      setIdle(null);
    };
  }, [paused, targetRef, boundsRef]);

  // Cursor proximity: one mousemove listener, measured at most once per frame.
  useEffect(() => {
    let frame = 0;
    let release = 0;
    let pointer: { x: number; y: number } | null = null;
    let isNear = false;
    let look = NO_LOOK;
    const showLook = (next: NimbusLook) => {
      if (next.x === look.x && next.y === look.y) return;
      look = next;
      setCursorLook(next);
    };
    const enter = () => {
      window.clearTimeout(release);
      release = 0;
      if (!isNear) {
        isNear = true;
        setNear(true);
      }
    };
    // Calms down shortly after the cursor leaves, so the edge of the radius does not flicker.
    const leave = () => {
      if (!isNear || release) return;
      release = window.setTimeout(() => {
        release = 0;
        isNear = false;
        setNear(false);
      }, EXCITE_RELEASE_MS);
    };
    const measure = () => {
      frame = 0;
      const rect = targetRef.current?.getBoundingClientRect();
      // Zero-sized when hidden (narrow screens).
      if (!pointer || !rect || rect.width === 0) return;
      const dx = pointer.x - (rect.left + rect.width / 2);
      const dy = pointer.y - (rect.top + rect.height / 2);
      const distance = Math.hypot(dx, dy);
      if (distance < EXCITE_RADIUS_PX) enter();
      else leave();
      showLook(distance < LOOK_RADIUS_PX ? lookToward(dx, dy, distance) : NO_LOOK);
    };
    const onMove = (event: MouseEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    const onLeaveWindow = () => {
      pointer = null;
      leave();
      showLook(NO_LOOK);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeaveWindow);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeaveWindow);
      window.cancelAnimationFrame(frame);
      window.clearTimeout(release);
    };
  }, [targetRef]);

  useEffect(() => () => window.clearTimeout(clickTimer.current), []);

  /** The click reaction: squish, spring up and a quick wave. Instant; a click mid-reaction is ignored. */
  const react = useCallback(() => {
    if (reduceMotion || clickTimer.current) return;
    setClicking(true);
    clickTimer.current = window.setTimeout(() => {
      clickTimer.current = 0;
      setClicking(false);
    }, CLICK_REACTION_MS);
  }, [reduceMotion]);

  const mood: NimbusMood = thinking ? "thinking" : near ? "excited" : idle === "wander" ? "wandering" : "happy";
  const action: NimbusAction = thinking ? "none" : clicking ? "clickSquish" : near ? "none" : idle ?? "none";
  // lookAround and wander sweep the pupils in CSS, so the cursor offset sits those out.
  const look = mood === "thinking" ? THINKING_LOOK : reduceMotion || action === "lookAround" || action === "wander" ? NO_LOOK : cursorLook;

  return { mood, action, look, blink, wanderX, react };
}
