"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface DeleteConfirmationModalProps {
  title: string;
  description: string;
  onDelete: () => Promise<void>;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DeleteConfirmationModal({
  title,
  description,
  onDelete,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: DeleteConfirmationModalProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = setControlledOpen ?? setUncontrolledOpen;

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await onDelete();
        toast.success("Deleted successfully");
        setOpen(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Delete failed");
      }
    });
  };

  return (
    <>
      {trigger && (
        <div onClick={() => setOpen(true)} className="inline-block">
          {trigger}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              {title}
            </DialogTitle>
            <DialogDescription className="pt-2">
              {description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6">
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
              className="min-w-[100px]"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
