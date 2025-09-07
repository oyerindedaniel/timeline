export function generateTimelineId(prefix: string = "timeline"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 11)}`;
}
