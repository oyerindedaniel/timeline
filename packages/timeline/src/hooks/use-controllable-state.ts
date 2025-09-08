import { useCallback, useState } from "react";

type OnChangeHandler<T, ExtraArgs extends any[] = []> = (
  value: T,
  ...args: ExtraArgs
) => void;

interface UseComposableStateOptions<T, ExtraArgs extends any[] = []> {
  defaultValue: T;
  controlled?: T;
  onChange?: OnChangeHandler<T, ExtraArgs>;
}

/**
 * Creates a controllable state that can be either controlled or uncontrolled
 * Similar to React's built-in controlled/uncontrolled pattern
 */
export function useComposableState<T, ExtraArgs extends any[] = []>({
  defaultValue,
  controlled,
  onChange,
}: UseComposableStateOptions<T, ExtraArgs>) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = controlled !== undefined;
  const value = isControlled ? controlled : internalValue;

  const setValue = useCallback(
    (newValue: T | ((prev: T) => T), ...args: ExtraArgs) => {
      const resolvedValue =
        typeof newValue === "function"
          ? (newValue as (prev: T) => T)(value)
          : newValue;

      if (!isControlled) {
        setInternalValue(resolvedValue);
      }

      onChange?.(resolvedValue, ...args);
    },
    [isControlled, value, onChange]
  );

  return [value, setValue] as const;
}
