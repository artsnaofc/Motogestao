import * as React from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";

export function DropdownMenu({ children, ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="dropdown-menu" {...props}>{children}</PopoverPrimitive.Root>;
}

export function DropdownMenuTrigger({ 
  children, 
  asChild, 
  render,
  ...props 
}: PopoverPrimitive.Trigger.Props & { asChild?: boolean }) {
  const triggerRender = render || (asChild && React.isValidElement(children) ? children : undefined);
  return (
    <PopoverPrimitive.Trigger 
      data-slot="dropdown-menu-trigger" 
      render={triggerRender} 
      {...props}
    >
      {triggerRender ? null : children}
    </PopoverPrimitive.Trigger>
  );
}

export function DropdownMenuContent({
  className,
  align = "end",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  children,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<
    PopoverPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <PopoverPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            "z-50 min-w-[160px] origin-(--transform-origin) overflow-hidden rounded-xl border border-border/80 bg-card p-1 text-card-foreground shadow-lg backdrop-blur-md outline-hidden duration-150 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        >
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  children,
  onClick,
  ...props
}: React.ComponentPropsWithoutRef<"button">) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none transition-colors hover:bg-muted hover:text-foreground text-muted-foreground focus:bg-muted focus:text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn("-mx-1 my-1 h-px bg-border/60", className)}
      {...props}
    />
  );
}
