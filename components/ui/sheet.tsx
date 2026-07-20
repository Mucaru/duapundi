"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;

function SheetContent({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="sheet-overlay fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        className={cn(
          "sheet-content fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92svh] max-w-lg flex-col rounded-t-3xl border-t border-border bg-surface shadow-xl",
          className
        )}
        {...props}
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border" />
          {children}
        </div>
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-full bg-surface/90 p-2 text-ink-muted backdrop-blur hover:bg-surface-muted">
          <X className="h-4 w-4" />
          <span className="sr-only">Tutup</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

const SheetTitle = DialogPrimitive.Title;

export { Sheet, SheetTrigger, SheetContent, SheetTitle };
