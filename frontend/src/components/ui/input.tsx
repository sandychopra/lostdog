import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-white px-3 text-base outline-none md:text-sm focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}
