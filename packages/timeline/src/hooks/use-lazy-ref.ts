import { useRef } from "react";

/**
 * Creates a ref that is lazily initialized
 * The initializer function is only called once when the ref is first accessed
 */
export function useLazyRef<T>(initializer: () => T): React.RefObject<T> {
  const ref = useRef<T | undefined>(undefined);

  if (ref.current === undefined) {
    ref.current = initializer();
  }

  return ref as React.RefObject<T>;
}
