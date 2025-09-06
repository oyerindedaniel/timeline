import React from "react";
import { cn } from "./cn";

/**
 * Slot component for polymorphic rendering
 * Allows components to render as different HTML elements or custom components
 */
type SlotProps = React.HTMLAttributes<HTMLElement> & {
  children?: React.ReactNode;
};

export function Slot({ children, ...slotProps }: SlotProps) {
  const child = React.Children.only(children);

  if (React.isValidElement(child)) {
    const childProps = child.props as Record<string, any>;

    const mergedProps = {
      ...slotProps,
      ...childProps,
      className: cn(slotProps.className, childProps.className),
      style: { ...slotProps.style, ...childProps.style },
    };

    return React.cloneElement(child, mergedProps);
  }

  return null;
}

Slot.displayName = "Slot";
