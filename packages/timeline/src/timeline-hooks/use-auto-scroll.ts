import { useRef, useCallback } from "react";

interface UseAutoScrollOptions {
  /** Distance from edge (px) where scroll starts */
  edgeThreshold?: number;

  /** Max scroll speed in pixels per frame */
  maxScrollSpeed?: number;

  /** Curve factor for acceleration near edge */
  acceleration?: number;

  /**
   * Extra margin outside the container (px) where mouse
   * movement can still trigger auto-scroll.
   * Defaults to 50.
   */
  activationMargin?: number;
}

/**
 * Custom React hook for auto-scrolling a container
 * when the mouse nears its edges.
 *
 * Supports acceleration, max speed, and an activation margin.
 *
 * @param options - Auto-scroll configuration
 * @returns Handlers to control auto-scroll behavior
 */
export function useAutoScroll({
  edgeThreshold = 80,
  maxScrollSpeed = 25,
  acceleration = 2.5,
  activationMargin = 50,
}: UseAutoScrollOptions = {}) {
  const isInitializedRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const lastMouseEventRef = useRef<MouseEvent | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onScrollChangeRef = useRef<
    ((scrollDelta: number, currentScrollLeft: number) => void) | null
  >(null);

  const calculateScrollSpeed = useCallback(
    (distanceFromEdge: number) => {
      if (distanceFromEdge >= edgeThreshold) return 0;
      const proximity = 1 - distanceFromEdge / edgeThreshold;
      const accelerated = Math.pow(proximity, acceleration);
      return accelerated * maxScrollSpeed;
    },
    [edgeThreshold, maxScrollSpeed, acceleration]
  );

  const loop = useCallback(() => {
    if (!isInitializedRef.current) return;

    const container = containerRef.current;
    const event = lastMouseEventRef.current;

    if (container && event) {
      const rect = container.getBoundingClientRect();
      const rawMouseX: number = event.clientX;

      // Apply activation margin
      const minX: number = rect.left - activationMargin;
      const maxX: number = rect.right + activationMargin;
      const mouseX: number = Math.max(minX, Math.min(rawMouseX, maxX));

      const distanceFromLeft = mouseX - rect.left;
      const distanceFromRight = rect.right - mouseX;

      let scrollDirection = 0;
      let speed = 0;

      if (distanceFromLeft < edgeThreshold) {
        scrollDirection = -1;
        speed = calculateScrollSpeed(distanceFromLeft);
      } else if (distanceFromRight < edgeThreshold) {
        scrollDirection = 1;
        speed = calculateScrollSpeed(distanceFromRight);
      }

      if (scrollDirection !== 0 && speed > 0) {
        const oldScrollLeft = container.scrollLeft;
        const newScrollLeft = container.scrollLeft + scrollDirection * speed;
        const maxScrollLeft = container.scrollWidth - container.clientWidth;
        const clampedScrollLeft = Math.max(
          0,
          Math.min(newScrollLeft, maxScrollLeft)
        );

        container.scrollLeft = clampedScrollLeft;

        const scrollDelta = clampedScrollLeft - oldScrollLeft;
        if (scrollDelta !== 0 && onScrollChangeRef.current) {
          onScrollChangeRef.current(scrollDelta, clampedScrollLeft);
        }
      }
    }

    rafIdRef.current = requestAnimationFrame(loop);
  }, [calculateScrollSpeed, edgeThreshold, activationMargin]);

  /**
   * Call this inside a mouse move listener
   * to update auto-scroll tracking.
   */
  const handleAutoScroll = useCallback((event: MouseEvent) => {
    lastMouseEventRef.current = event;
  }, []);

  /**
   * Starts auto-scrolling for the given container.
   *
   * @param container - Scrollable container element
   * @param onScrollChange - Callback fired when scroll changes
   */
  const startAutoScroll = useCallback(
    (
      container: HTMLDivElement | null,
      onScrollChange?: (scrollDelta: number, currentScrollLeft: number) => void
    ) => {
      if (!isInitializedRef.current && container) {
        containerRef.current = container;
        isInitializedRef.current = true;
        onScrollChangeRef.current = onScrollChange || null;

        rafIdRef.current = requestAnimationFrame(loop);
      }
    },
    [loop]
  );

  /**
   * Stops auto-scrolling and cleans up listeners.
   */
  const stopAutoScroll = useCallback(() => {
    isInitializedRef.current = false;
    containerRef.current = null;
    onScrollChangeRef.current = null;
    lastMouseEventRef.current = null;
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  return {
    handleAutoScroll,
    startAutoScroll,
    stopAutoScroll,
  };
}
