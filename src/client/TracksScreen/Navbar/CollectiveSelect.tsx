"use client";

import * as React from "react";
import { CheckboxIcon, CheckIcon } from "@radix-ui/react-icons";
import * as SelectPrimitive from "@radix-ui/react-select";

import { cn } from "@/lib/utils";
import { IconChevron } from "@/client/components/Icons";

const CollectiveSelect = SelectPrimitive.Root;

const CollectiveSelectGroup = SelectPrimitive.Group;

const CollectiveSelectValue = SelectPrimitive.Value;

const CollectiveSelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-12 w-full items-center justify-between space-x-4 rounded-lg border border-transparent bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground hover:border hover:border-input hover:border-slate-200 hover:bg-gray-100 hover:shadow-sm focus:outline-none focus:ring-1 focus:ring-ring active:shadow-sm disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <IconChevron className="inline-block h-5 w-5 stroke-current" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
CollectiveSelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const CollectiveSelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "data-[state=open]:animate-in group data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
CollectiveSelectContent.displayName = SelectPrimitive.Content.displayName;

const CollectiveSelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", className)}
    {...props}
  />
));
CollectiveSelectLabel.displayName = SelectPrimitive.Label.displayName;

const CollectiveSelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50 relative flex w-full cursor-default select-none items-center rounded-md py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent/90 focus:text-accent-foreground",
      "group-data-[state=open]:rounded-lg group-data-[state=open]:py-2.5 group-data-[state=open]:px-3.5",
      className
    )}
    {...props}
  >
    <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <CheckIcon className="mr-3 h-7 w-7" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
CollectiveSelectItem.displayName = SelectPrimitive.Item.displayName;

const CollectiveSelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
));
CollectiveSelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  CollectiveSelect,
  CollectiveSelectGroup,
  CollectiveSelectValue,
  CollectiveSelectTrigger,
  CollectiveSelectContent,
  CollectiveSelectLabel,
  CollectiveSelectItem,
  CollectiveSelectSeparator,
};
