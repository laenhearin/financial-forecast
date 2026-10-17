"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { bpRootClass } from "../fonts";
import { Bounce } from "./motion";
import { primaryButtonClass, secondaryButtonClass } from "./ui";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={next => onOpenChange(next)}>
      <DialogContent
        showCloseButton={false}
        className={`${bpRootClass} gap-5 rounded-(--bp-radius-card) border border-(--bp-line) bg-(--bp-surface) p-6 text-(--bp-ink) shadow-(--bp-shadow-card) duration-200 data-open:zoom-in-[0.96] motion-reduce:animate-none sm:max-w-md`}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
          <DialogDescription className="text-(--bp-muted)">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="mx-0 mb-0 gap-3 rounded-none border-0 bg-transparent p-0">
          <DialogClose render={<Button variant="outline" className={secondaryButtonClass} />}>Cancel</DialogClose>
          <Bounce>
            <Button className={primaryButtonClass} onClick={() => { onConfirm(); onOpenChange(false); }}>{confirmLabel}</Button>
          </Bounce>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
