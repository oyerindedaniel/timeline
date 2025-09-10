import { useCallback, useState } from "react";

type OnChangeHandler<T, ExtraArgs extends any[] = []> = (
  value: T,
  ...args: ExtraArgs
) => void;

interface UseControllableStateOptions<T, ExtraArgs extends any[] = []> {
  defaultValue: T;
  controlled?: T;
  onChange?: OnChangeHandler<T, ExtraArgs>;
}

/**
 * Creates a controllable state that can be either controlled or uncontrolled.
 * - Controlled when `controlled` is defined.
 * - Uncontrolled otherwise, starting from `defaultValue`.
 */
export function useControllableState<T, ExtraArgs extends any[] = []>({
  defaultValue,
  controlled,
  onChange,
}: UseControllableStateOptions<T, ExtraArgs>) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = controlled !== undefined;
  const value = isControlled ? controlled : internalValue;

  const setValue = useCallback(
    (newValue: T | ((prev: T) => T), ...args: ExtraArgs) => {
      const updater = (prev: T) =>
        typeof newValue === "function"
          ? (newValue as (prev: T) => T)(prev)
          : newValue;

      const resolvedValue = updater(value);

      if (!isControlled) {
        setInternalValue(updater);
      }

      onChange?.(resolvedValue, ...args);
    },
    [isControlled, onChange, value]
  );

  return [value, setValue] as const;
}
