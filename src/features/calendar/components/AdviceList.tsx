import { cn } from "@/lib/utils";
import type { AdviceItem } from "../types";
import { TONE_BG } from "./ui";

export function AdviceList({ items }: { items: AdviceItem[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="my-4 flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item.id} className="rounded-item border border-app bg-card p-3.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-body font-semibold text-primary">{item.title}</p>
            <span className={cn("shrink-0 rounded-full px-2 py-1 text-micro font-medium whitespace-nowrap text-primary", TONE_BG[item.tone])}>{item.tag}</span>
          </div>
          <p className="mt-2 text-caption text-secondary">{item.text}</p>
          {item.meta && <p className="mt-1.5 text-micro text-secondary">{item.meta}</p>}
        </li>
      ))}
    </ul>
  );
}
