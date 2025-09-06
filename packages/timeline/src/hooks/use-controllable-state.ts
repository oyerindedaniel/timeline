import { useCallback, useState } from "react";

export interface UseControllableStateProps<T> {
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
}

/**
 * Creates a controllable state that can be either controlled or uncontrolled
 * Similar to React's built-in controlled/uncontrolled pattern
 */
export function useControllableState<T>({
  value,
  defaultValue,
  onChange,
}: UseControllableStateProps<T>) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);

  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : uncontrolledValue;

  const setValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      const nextValue =
        typeof newValue === "function"
          ? (newValue as (prev: T) => T)(currentValue)
          : newValue;

      if (!isControlled) {
        setUncontrolledValue(nextValue);
      }

      onChange?.(nextValue);
    },
    [isControlled, currentValue, onChange]
  );

  return [currentValue, setValue] as const;
}
