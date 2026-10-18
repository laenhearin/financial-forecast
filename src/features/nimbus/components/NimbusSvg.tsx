import { useId, type CSSProperties } from "react";
import { NIMBUS_COLORS as C, NIMBUS_SIZE } from "../config";
import type { NimbusAction, NimbusLook, NimbusMood } from "../types";
import styles from "./nimbus.module.css";

export interface NimbusSvgProps {
  mood: NimbusMood;
  action: NimbusAction;
  /** Pupil offset in SVG units. */
  look: NimbusLook;
  blink?: boolean;
  /** Width in CSS pixels. */
  size?: number;
  /** Holds a still pose: no float, actions or transitions; thinking dots only fade. */
  reduceMotion?: boolean;
}

const EYE_Y = 62;
const EYE_XS = [47, 73];

/** The cloud's three bumps and flat base, drawn as the outline, the fill and the inner-shadow clip. */
function CloudShapes() {
  return (
    <>
      <circle cx="40" cy="57" r="21" />
      <circle cx="62" cy="45" r="25" />
      <circle cx="85" cy="58" r="18" />
      <rect x="17" y="52" width="86" height="40" rx="20" />
    </>
  );
}

function Eye({ x, squint }: { x: number; squint: boolean }) {
  if (squint) {
    return <path d={`M${x - 4.6} ${EYE_Y + 1.6} Q${x} ${EYE_Y - 4.6} ${x + 4.6} ${EYE_Y + 1.6}`} fill="none" stroke={C.ink} strokeWidth="2.6" strokeLinecap="round" />;
  }
  return (
    <g className={styles.eyeSize}>
      <g className={styles.eyeLid}>
        <ellipse cx={x} cy={EYE_Y} rx="4.4" ry="6.2" fill={C.ink} />
        <circle cx={x - 1.4} cy={EYE_Y - 2.5} r="1.7" fill={C.sparkle} />
        <circle cx={x + 1.5} cy={EYE_Y + 2.4} r="0.8" fill={C.sparkle} opacity="0.8" />
      </g>
    </g>
  );
}

function Mouth({ mood }: { mood: NimbusMood }) {
  if (mood === "excited") {
    return (
      <>
        <path d="M53.5 68.5 Q60 80 66.5 68.5 Z" fill={C.ink} stroke={C.ink} strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M57 72.8 Q60 70.6 63 72.8 Q60 74.8 57 72.8 Z" fill={C.tongue} />
      </>
    );
  }
  if (mood === "thinking") return <ellipse cx="61" cy="71.5" rx="2.3" ry="2.8" fill={C.ink} />;
  return <path d="M55 69.5 Q60 74.5 65 69.5" fill="none" stroke={C.ink} strokeWidth="2.4" strokeLinecap="round" />;
}

/**
 * Nimbus, drawn in a 120 × 120 viewBox. Pure: it renders the mood, action and look it is given,
 * and CSS keyframes (nimbus.module.css) animate the groups by data attribute.
 */
export function NimbusSvg({ mood, action, look, blink = false, size = NIMBUS_SIZE.default, reduceMotion = false }: NimbusSvgProps) {
  // Gradient, clip and filter ids must be unique per instance (sidebar and chat header).
  const id = `nimbus-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const bodyFill = `url(#${id}-body)`;
  const squint = action === "wave" || action === "clickSquish";
  const style = { "--nimbus-look-x": look.x, "--nimbus-look-y": look.y, "--nimbus-glow": C.glow } as CSSProperties;

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={styles.svg}
      data-mood={mood}
      data-action={action}
      data-blink={blink || undefined}
      data-reduce-motion={reduceMotion || undefined}
      style={style}
    >
      <defs>
        <radialGradient id={`${id}-body`} gradientUnits="userSpaceOnUse" cx="40" cy="30" r="72">
          <stop offset="0" stopColor={C.bodyHighlight} />
          <stop offset="0.2" stopColor={C.bodyHighlight} />
          <stop offset="0.55" stopColor={C.bodyMid} />
          <stop offset="1" stopColor={C.bodyEdge} />
        </radialGradient>
        <radialGradient id={`${id}-gloss`}>
          <stop offset="0" stopColor={C.bodyHighlight} stopOpacity="0.95" />
          <stop offset="0.6" stopColor={C.bodyHighlight} stopOpacity="0.6" />
          <stop offset="1" stopColor={C.bodyHighlight} stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}-clip`}>
          <CloudShapes />
        </clipPath>
        <filter id={`${id}-soft`} x="-20%" y="-60%" width="140%" height="220%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <filter id={`${id}-blur`} x="-20%" y="-100%" width="140%" height="300%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>

      {/* Ground shadow: shrinks and fades as Nimbus rises. */}
      <g className={styles.shadowFloat}>
        <g className={styles.shadowAct}>
          <ellipse cx="60" cy="107" rx="28" ry="4.5" fill={C.ink} opacity="0.2" filter={`url(#${id}-blur)`} />
        </g>
      </g>

      <g className={styles.float}>
        <g className={styles.act}>
          <g className={styles.armLeft}>
            <rect x="6" y="66" width="17" height="11" rx="5.5" fill={bodyFill} stroke={C.outline} strokeOpacity="0.6" strokeWidth="2.5" />
          </g>
          <g className={styles.armRight}>
            <rect x="97" y="66" width="17" height="11" rx="5.5" fill={bodyFill} stroke={C.outline} strokeOpacity="0.6" strokeWidth="2.5" />
          </g>

          {/* Outline under the fill, so only its outer half shows around the whole cloud. */}
          <g fill="none" stroke={C.outline} strokeWidth="5" opacity="0.6">
            <CloudShapes />
          </g>
          <g fill={bodyFill}>
            <CloudShapes />
          </g>
          <g clipPath={`url(#${id}-clip)`}>
            <ellipse cx="60" cy="97" rx="46" ry="13" fill={C.outline} opacity="0.5" filter={`url(#${id}-soft)`} />
          </g>
          <ellipse cx="47" cy="31" rx="10" ry="5" transform="rotate(-28 47 31)" fill={`url(#${id}-gloss)`} />
          <circle cx="35.5" cy="45" r="2.3" fill={C.bodyHighlight} opacity="0.9" />

          <g className={styles.look}>
            <g className={styles.eyesAct}>
              {EYE_XS.map((x) => <Eye key={x} x={x} squint={squint} />)}
            </g>
          </g>
          <ellipse className={styles.cheek} cx="37" cy="71.5" rx="5.8" ry="3.3" fill={C.cheek} />
          <ellipse className={styles.cheek} cx="83" cy="71.5" rx="5.8" ry="3.3" fill={C.cheek} />
          <Mouth mood={mood} />
        </g>

        {mood === "thinking" && (
          <g fill={C.bodyHighlight} stroke={C.outline} strokeWidth="1.5">
            <circle className={styles.dot} cx="88" cy="24" r="2.4" />
            <circle className={styles.dot} cx="95.5" cy="14.5" r="3" />
            <circle className={styles.dot} cx="104" cy="5" r="3.6" />
          </g>
        )}
      </g>
    </svg>
  );
}
