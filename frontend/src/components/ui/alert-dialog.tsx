import type { ComponentProps, HTMLAttributes } from "react";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";
import { cn } from "../../lib/utils";
import { buttonVariants } from "./button";

export const AlertDialog = AlertDialogPrimitive.Root;

export function AlertDialogContent({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay className="fixed inset-0 bg-navy/40" />
      <AlertDialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg",
          className,
        )}
        {...props}
      />
    </AlertDialogPrimitive.Portal>
  );
}

export function AlertDialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-2", className)} {...props} />;
}

export function AlertDialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-6 flex justify-end gap-2", className)} {...props} />;
}

export function AlertDialogTitle({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      className={cn("text-lg font-semibold text-navy", className)}
      {...props}
    />
  );
}

export function AlertDialogDescription({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export function AlertDialogCancel({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel
      className={cn(buttonVariants({ variant: "secondary" }), className)}
      {...props}
    />
  );
}

export function AlertDialogAction({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Action>) {
  return (
    <AlertDialogPrimitive.Action
      className={cn(buttonVariants({ variant: "destructive" }), className)}
      {...props}
    />
  );
}
