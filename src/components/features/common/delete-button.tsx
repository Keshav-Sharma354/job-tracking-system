"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/primitives";

/**
 * Destructive action affordance.
 *
 * Deletion is behind an explicit confirmation dialog that names the record, so
 * an accidental click cannot destroy data. The dialog is uncontrolled and closes
 * itself on success.
 */
export function DeleteButton({
  onDelete,
  entityName,
  description,
  size = "icon-sm",
}: {
  onDelete: () => Promise<{ ok: boolean; error?: string; message?: string } | null>;
  entityName: string;
  description?: string;
  size?: "sm" | "icon-sm";
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function confirm() {
    setPending(true);
    const result = await onDelete();
    setPending(false);

    if (!result) return;

    if (result.ok) {
      setOpen(false);
      toast.success(result.message ?? `${entityName} deleted`);
      router.refresh();
    } else {
      toast.error(result.error ?? "Could not delete");
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size={size} aria-label={`Delete ${entityName}`}>
            <Trash2 />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem destructive onSelect={() => setOpen(true)}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {entityName}?</DialogTitle>
            <DialogDescription>
              {description ??
                "This cannot be undone. Anything linked to it will be removed too."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button variant="danger" onClick={confirm} loading={pending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
