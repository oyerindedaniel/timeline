/**
 * Utility function to merge class names
 * Similar to clsx or classnames but simpler
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
