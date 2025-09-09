import { useRef, useCallback, useEffect, useState } from "react";
import { useLatestValue } from "../hooks/use-latest-value";

/**
 * Fixed scaling configuration - always uses the specified pixels per second.
 */
type FixedScalingConfig = {
  type: "fixed";
  fixedPxPerSecond: number;
};

/**
 * Container-based scaling configuration - scales timeline
 * proportionally to the container width.
 */
type ContainerScalingConfig = {
  type: "container";
};

/**
 * Auto scaling configuration - chooses between fixed scaling
 * and container-based scaling depending on container width and
 * min/max usability constraints.
 */
type AutoScalingConfig = {
  type: "auto";
  fixedPxPerSecond: number;
  minPxPerSecond?: number;
  maxPxPerSecond?: number;
};

/**
 * Union of supported scaling configurations.
 */
type UseScaleConfig =
  | FixedScalingConfig
  | ContainerScalingConfig
  | AutoScalingConfig;

/**
 * Possible scaling modes currently in effect.
 */
type ScalingType = "fixed" | "container" | "auto";

/**
 * React hook for calculating timeline scaling (pixels per millisecond).
 * Supports fixed, container-based, and auto scaling strategies.
 *
 * - **Fixed:** Always uses a constant pixels-per-second value.
 * - **Container:** Fits the entire duration to the container width.
 * - **Auto:** Switches between container scaling and fixed scaling
 *   depending on size and min/max constraints.
 *
 * Scaling is recalculated on mount and on window resize
 * when using "container" or "auto" modes.
 *
 * @param containerRef - Ref to the container element
 * @param durationMs - Total duration of the timeline in milliseconds
 * @param config - Scaling configuration (fixed, container, or auto)
 * @returns {UseScaleReturn} Scaling ref, recalc function, and active scaling type
 */
export function useScale({
  containerRef,
  durationMs,
  ...config
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  durationMs: number;
} & UseScaleConfig) {
  const [pxPerMs, setPxPerMs] = useState(0);
  const currentScalingTypeRef = useRef<ScalingType>("container");
  const configRef = useLatestValue(config);

  const recalc = useCallback(() => {
    const config = configRef.current;

    if (config.type === "fixed") {
      const value = config.fixedPxPerSecond / 1000;
      setPxPerMs(value);
      currentScalingTypeRef.current = "fixed";
      return;
    }

    if (config.type === "container") {
      const el = containerRef.current;
      if (!el) return;

      const width = el.clientWidth;
      const containerPxPerMs =
        durationMs > 0 && width > 0 ? width / durationMs : 0.05;

      setPxPerMs(containerPxPerMs);
      currentScalingTypeRef.current = "container";
      return;
    }

    if (config.type === "auto") {
      const el = containerRef.current;
      if (!el) return;

      const width = el.clientWidth;
      const containerPxPerMs =
        durationMs > 0 && width > 0 ? width / durationMs : 0;
      const fixedPxPerMs = config.fixedPxPerSecond / 1000;

      const containerPxPerSecond = containerPxPerMs * 1000;

      const minPxPerSecond = config.minPxPerSecond ?? config.fixedPxPerSecond;
      const isContainerTooSmall = containerPxPerSecond < minPxPerSecond;

      const isContainerTooLarge =
        config.maxPxPerSecond && containerPxPerSecond > config.maxPxPerSecond;

      let finalValue;
      if (isContainerTooSmall || isContainerTooLarge) {
        finalValue = fixedPxPerMs;
      } else {
        finalValue = containerPxPerMs;
      }

      setPxPerMs(finalValue);
      currentScalingTypeRef.current = "auto";
    }
  }, [durationMs]);

  useEffect(() => {
    recalc();

    if (config.type === "container" || config.type === "auto") {
      window.addEventListener("resize", recalc);
      return () => window.removeEventListener("resize", recalc);
    }
  }, [recalc, config.type]);

  return {
    pxPerMs,
    recalc,
    currentScalingType: currentScalingTypeRef.current,
  };
}
