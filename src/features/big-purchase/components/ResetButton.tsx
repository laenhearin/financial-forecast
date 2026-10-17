"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Bounce } from "./motion";
import { secondaryButtonClass } from "./ui";

/** Enabled only for drafts; otherwise disabled with an explanatory tooltip. */
export function ResetButton({ enabled, onClick }: { enabled: boolean; onClick: () => void }) {
  const button = (
    <Button variant="outline" className={secondaryButtonClass} disabled={!enabled} onClick={onClick}>
      <RotateCcw aria-hidden /> Reset
    </Button>
  );
  if (enabled) return <Bounce>{button}</Bounce>;
  return (
    <Tooltip>
      <TooltipTrigger render={<span tabIndex={0} className="inline-flex rounded-(--bp-radius-control)" aria-label="Reset is unavailable. Switch to draft to reset." />}>
        {button}
      </TooltipTrigger>
      <TooltipContent>Switch to draft to reset.</TooltipContent>
    </Tooltip>
  );
}
