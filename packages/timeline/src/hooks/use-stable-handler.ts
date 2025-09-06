import { useMemo, useRef } from "react";

/**
 * Creates a stable handler that doesn't change on every render
 * but always calls the latest version of the function
 */
export function useStableHandler<T extends (...args: any[]) => any>(
  handler: T | undefined
): T | undefined {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  return useMemo(() => {
    if (!handler) return undefined;
    return ((...args: Parameters<T>) => {
      return handlerRef.current?.(...args);
    }) as T;
  }, [!!handler]);
}
