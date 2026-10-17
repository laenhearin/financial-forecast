import { cn } from "@/lib/utils";
import type { CreditCard } from "../types";

type Size = "sm" | "md" | "lg";

/** Width × height and corner radius per size; all close to a real card's 1.586:1. */
const SIZES: Record<Size, { box: string; chip: string; issuer: string; name: string; network: string }> = {
  sm: { box: "h-9 w-14 rounded-[6px]", chip: "left-1.5 h-2.5 w-3.5 rounded-[2px]", issuer: "", name: "", network: "" },
  md: {
    box: "h-[76px] w-[120px] rounded-[10px]", chip: "left-2.5 h-3.5 w-5 rounded-[3px]",
    issuer: "top-2 left-2.5 text-[8px]", name: "bottom-2 left-2.5 max-w-[52%] text-[10px]", network: "bottom-2 right-2.5 text-[7px]",
  },
  lg: {
    box: "h-[176px] w-[280px] rounded-[14px]", chip: "left-5 h-7 w-10 rounded-[5px]",
    issuer: "top-4 left-5 text-[11px]", name: "bottom-4 left-5 max-w-[58%] text-[16px]", network: "bottom-4 right-5 text-[12px]",
  },
};

/** An original gradient card face. No real card art, logos, or brand marks. Decorative: the name is always shown nearby. */
export function CardArt({ card, size = "sm", className }: { card: CreditCard; size?: Size; className?: string }) {
  const { gradientFrom, gradientTo, textColor } = card.visual;
  const style = SIZES[size];
  return (
    <span
      aria-hidden
      className={cn(
        "relative block shrink-0 overflow-hidden",
        // Thin inner border keeps light cards visible; the outer hairline uses the theme border.
        "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15),0_0_0_1px_var(--bd)]",
        style.box,
        className,
      )}
      style={{ backgroundImage: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`, color: textColor }}
    >
      <span className={cn("absolute top-1/2 -translate-y-1/2 border border-current/40 bg-current/25", style.chip)} />
      {size !== "sm" && (
        <>
          <span className={cn("absolute font-semibold tracking-wider uppercase", style.issuer)}>{card.issuer}</span>
          <span className={cn("absolute truncate leading-tight font-semibold", style.name)}>{card.name}</span>
          <span className={cn("absolute font-bold italic opacity-90", style.network)}>{card.network}</span>
        </>
      )}
    </span>
  );
}
