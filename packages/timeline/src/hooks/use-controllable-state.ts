import { useCallback, useState } from "react";

interface UseComposableStateOptions<T> {
  defaultValue: T;
  controlled?: T;
  onChange?: (value: T) => void;
}

/**
 * Creates a controllable state that can be either controlled or uncontrolled
 * Similar to React's built-in controlled/uncontrolled pattern
 */

export function useComposableState<T>({
  defaultValue,
  controlled,
  onChange,
}: UseComposableStateOptions<T>) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = controlled !== undefined;
  const value = isControlled ? controlled : internalValue;

  const setValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      const resolvedValue =
        typeof newValue === "function"
          ? (newValue as (prev: T) => T)(value)
          : newValue;

      if (!isControlled) {
        setInternalValue(resolvedValue);
      }

      onChange?.(resolvedValue);
    },
    [isControlled, value, onChange]
  );

  return [value, setValue] as const;
}
