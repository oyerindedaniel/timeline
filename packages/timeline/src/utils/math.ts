/**
 * Convert milliseconds to pixels based on the current scale.
 */
function msToPixels(ms: number, pxPerMs: number): number {
  return ms * pxPerMs;
}

/**
 * Convert pixels back to milliseconds based on the current scale.
 */
function pixelsToMs(px: number, pxPerMs: number): number {
  return px / pxPerMs;
}

/**
 * Clamp a time value between the configured min and max bounds.
 */
function clampTime(time: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, time));
}

export { msToPixels, pixelsToMs, clampTime };
