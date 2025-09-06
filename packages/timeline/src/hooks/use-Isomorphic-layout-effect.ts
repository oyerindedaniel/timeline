import { useEffect, useLayoutEffect } from "react";

/**
 * Use layout effect on client side, regular effect on server side
 * Prevents hydration mismatches
 */
export const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;
