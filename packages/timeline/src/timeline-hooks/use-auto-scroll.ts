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

  /** Enable vertical scrolling */
  enableVertical?: boolean;

  /** Vertical edge threshold (defaults to edgeThreshold) */
  verticalEdgeThreshold?: number;

  /** Max vertical scroll speed (defaults to maxScrollSpeed) */
  maxVerticalScrollSpeed?: number;
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
  enableVertical = false,
  verticalEdgeThreshold,
  maxVerticalScrollSpeed,
}: UseAutoScrollOptions = {}) {
  const isInitializedRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const lastMouseEventRef = useRef<MouseEvent | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onScrollChangeRef = useRef<
    | ((
        scrollDelta: { x: number; y: number },
        currentScroll: { x: number; y: number }
      ) => void)
    | null
  >(null);

  const vEdgeThreshold = verticalEdgeThreshold ?? edgeThreshold;
  const maxVScrollSpeed = maxVerticalScrollSpeed ?? maxScrollSpeed;

  const calculateScrollSpeed = useCallback(
    (distanceFromEdge: number, threshold: number, maxSpeed: number) => {
      if (distanceFromEdge >= threshold) return 0;
      const proximity = 1 - distanceFromEdge / threshold;
      const accelerated = Math.pow(proximity, acceleration);
      return accelerated * maxSpeed;
    },
    [acceleration]
  );

  const loop = useCallback(() => {
    if (!isInitializedRef.current) return;

    const container = containerRef.current;
    const event = lastMouseEventRef.current;

    if (container && event) {
      const rect = container.getBoundingClientRect();

      const rawMouseX = event.clientX;
      const minX = rect.left - activationMargin;
      const maxX = rect.right + activationMargin;
      const mouseX = Math.max(minX, Math.min(rawMouseX, maxX));

      const distanceFromLeft = mouseX - rect.left;
      const distanceFromRight = rect.right - mouseX;

      let horizontalScrollDirection = 0;
      let horizontalSpeed = 0;

      if (distanceFromLeft < edgeThreshold) {
        horizontalScrollDirection = -1;
        horizontalSpeed = calculateScrollSpeed(
          distanceFromLeft,
          edgeThreshold,
          maxScrollSpeed
        );
      } else if (distanceFromRight < edgeThreshold) {
        horizontalScrollDirection = 1;
        horizontalSpeed = calculateScrollSpeed(
          distanceFromRight,
          edgeThreshold,
          maxScrollSpeed
        );
      }

      let verticalScrollDirection = 0;
      let verticalSpeed = 0;

      if (enableVertical) {
        const rawMouseY = event.clientY;
        const minY = rect.top - activationMargin;
        const maxY = rect.bottom + activationMargin;
        const mouseY = Math.max(minY, Math.min(rawMouseY, maxY));

        const distanceFromTop = mouseY - rect.top;
        const distanceFromBottom = rect.bottom - mouseY;

        if (distanceFromTop < vEdgeThreshold) {
          verticalScrollDirection = -1;
          verticalSpeed = calculateScrollSpeed(
            distanceFromTop,
            vEdgeThreshold,
            maxVScrollSpeed
          );
        } else if (distanceFromBottom < vEdgeThreshold) {
          verticalScrollDirection = 1;
          verticalSpeed = calculateScrollSpeed(
            distanceFromBottom,
            vEdgeThreshold,
            maxVScrollSpeed
          );
        }
      }

      let scrollDelta = { x: 0, y: 0 };

      if (horizontalScrollDirection !== 0 && horizontalSpeed > 0) {
        const oldScrollLeft = container.scrollLeft;
        const newScrollLeft =
          container.scrollLeft + horizontalScrollDirection * horizontalSpeed;
        const maxScrollLeft = container.scrollWidth - container.clientWidth;
        const clampedScrollLeft = Math.max(
          0,
          Math.min(newScrollLeft, maxScrollLeft)
        );

        container.scrollLeft = clampedScrollLeft;
        scrollDelta.x = clampedScrollLeft - oldScrollLeft;
      }

      if (verticalScrollDirection !== 0 && verticalSpeed > 0) {
        const oldScrollTop = container.scrollTop;
        const newScrollTop =
          container.scrollTop + verticalScrollDirection * verticalSpeed;
        const maxScrollTop = container.scrollHeight - container.clientHeight;
        const clampedScrollTop = Math.max(
          0,
          Math.min(newScrollTop, maxScrollTop)
        );

        container.scrollTop = clampedScrollTop;
        scrollDelta.y = clampedScrollTop - oldScrollTop;
      }

      if (
        (scrollDelta.x !== 0 || scrollDelta.y !== 0) &&
        onScrollChangeRef.current
      ) {
        onScrollChangeRef.current(scrollDelta, {
          x: container.scrollLeft,
          y: container.scrollTop,
        });
      }
    }

    rafIdRef.current = requestAnimationFrame(loop);
  }, [
    calculateScrollSpeed,
    edgeThreshold,
    vEdgeThreshold,
    maxScrollSpeed,
    maxVScrollSpeed,
    activationMargin,
    enableVertical,
  ]);

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
      onScrollChange?: (
        scrollDelta: { x: number; y: number },
        currentScroll: { x: number; y: number }
      ) => void
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
