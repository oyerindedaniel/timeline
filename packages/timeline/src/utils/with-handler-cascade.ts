/**
 * Generic React synthetic event type wrapper.
 * Useful for creating reusable event utilities across different event kinds.
 */
type SyntheticEventGeneric = React.SyntheticEvent<unknown, Event>;

/**
 * Options for creating a cascaded event handler.
 *
 * @template E The React synthetic event type.
 */
type HandlerCascadeOptions<E extends SyntheticEventGeneric> = {
  /**
   * An optional handler passed from the consumer.
   * Runs before the internal handler and may call preventDefault().
   */
  consumerHandler?: (event: E) => void;

  /**
   * The internal handler for your component logic.
   * Runs only if defaultPrevented is still false after consumerHandler.
   */
  internalHandler: (event: E) => void;
};

/**
 * Creates a cascaded event handler that:
 * 1. Exits early if the event has already been prevented.
 * 2. Runs the optional consumer handler.
 * 3. Exits early if the consumer prevented the event.
 * 4. Runs the internal handler.
 *
 * @template E The React synthetic event type.
 * @param options Object containing consumerHandler and internalHandler.
 * @returns A composed event handler.
 */
export function withHandlerCascade<E extends SyntheticEventGeneric>(
  options: HandlerCascadeOptions<E>
): (event: E) => void {
  const { consumerHandler, internalHandler } = options;

  return (event: E) => {
    if (event.defaultPrevented) return;

    consumerHandler?.(event);
    if (event.defaultPrevented) return;

    internalHandler(event);
  };
}
