import React from "react";
import { cn } from "./cn";

/**
 * Slot component for polymorphic rendering
 * Allows components to render as different HTML elements or custom components
 */

// TODO: switch to radix slot
type SlotProps = React.HTMLAttributes<HTMLElement> & {
  children?: React.ReactNode;
};

export const Slot = React.forwardRef<HTMLElement, SlotProps>(
  ({ children, ...slotProps }, forwardedRef) => {
    const child = React.Children.only(children);

    if (!React.isValidElement(child)) {
      return null;
    }

    type ChildProps = Record<string, any>;
    const childProps = child.props as ChildProps;

    const mergedProps: Record<string, unknown> = {
      ...slotProps,
      ...childProps,
      className: cn(slotProps.className, childProps.className),
      style: { ...slotProps.style, ...childProps.style },
    };

    // merge event handlers
    for (const propName in slotProps) {
      const isHandler = /^on[A-Z]/.test(propName);
      const slotHandler = (slotProps as any)[propName];
      const childHandler = (childProps as any)[propName];

      if (isHandler && typeof slotHandler === "function") {
        mergedProps[propName] = (...args: unknown[]) => {
          if (typeof childHandler === "function") childHandler(...args);
          slotHandler(...args);
        };
      }
    }

    // merge refs
    mergedProps.ref = composeRefs(
      forwardedRef,
      (child as any).ref as React.Ref<HTMLElement>
    );

    return React.cloneElement(child, mergedProps);
  }
);

Slot.displayName = "Slot";

function composeRefs<T>(
  ...refs: (React.Ref<T> | undefined)[]
): React.RefCallback<T> {
  return (node: T) => {
    for (const ref of refs) {
      if (typeof ref === "function") {
        ref(node);
      } else if (ref != null) {
        (ref as React.RefObject<T | null>).current = node;
      }
    }
  };
}

Slot.displayName = "Slot";

// https://github.com/radix-ui/primitives/blob/main/packages/react

export function getElementRef(
  element: React.ReactElement<{ ref?: React.Ref<unknown> }>
) {
  // React <=18 in DEV
  let getter = Object.getOwnPropertyDescriptor(element.props, "ref")?.get;
  let mayWarn = getter && "isReactWarning" in getter && getter.isReactWarning;
  if (mayWarn) {
    return (element as any).ref;
  }

  // React 19 in DEV
  getter = Object.getOwnPropertyDescriptor(element, "ref")?.get;
  mayWarn = getter && "isReactWarning" in getter && getter.isReactWarning;
  if (mayWarn) {
    return element.props.ref;
  }

  // Not DEV
  return element.props.ref || (element as any).ref;
}
