import * as React from "react";
import { cn } from "../../lib/utils";

// Browsers with CSS `field-sizing: content` grow the box to fit its text on
// their own; elsewhere (older Safari/Firefox) the height is set from
// scrollHeight on input instead.
const supportsFieldSizing =
  typeof CSS !== "undefined" &&
  typeof CSS.supports === "function" &&
  CSS.supports("field-sizing", "content");

function fitToContent(node: HTMLTextAreaElement) {
  node.style.height = "auto";
  node.style.height = `${node.scrollHeight + node.offsetHeight - node.clientHeight}px`;
}

function Textarea({ className, ref, onInput, ...props }: React.ComponentProps<"textarea">) {
  // react-hook-form's register() passes its own ref, so it's forwarded too.
  const setRef = React.useCallback(
    (node: HTMLTextAreaElement | null) => {
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
      // register() fills the value in after the ref is attached.
      if (node && !supportsFieldSizing) requestAnimationFrame(() => fitToContent(node));
    },
    [ref],
  );

  return (
    <textarea
      data-slot="textarea"
      ref={setRef}
      onInput={(event) => {
        if (!supportsFieldSizing) fitToContent(event.currentTarget);
        onInput?.(event);
      }}
      className={cn(
        "flex min-h-20 max-h-96 w-full overflow-y-auto field-sizing-content rounded-md border border-input bg-white px-3 py-2 text-base outline-none md:text-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
