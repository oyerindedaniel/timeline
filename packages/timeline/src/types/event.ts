import { ResizeSide } from ".";

// =====================================
// Event Primitives
// =====================================
export type TimelineMouseEvent<T = Element, E = MouseEvent> = React.MouseEvent<
  T,
  E
>;
export type TimelineKeyboardEvent<T = Element> = React.KeyboardEvent<T>;
export type TimelineEvent<T = Element, E = MouseEvent | KeyboardEvent> =
  | TimelineMouseEvent<T, E>
  | TimelineKeyboardEvent<T>;

// =====================================
// Change Event Types
// =====================================
export type TimeChangeEvent = (time: number, event: TimelineEvent) => void;
export type PositionChangeEvent = (
  position: number,
  event: TimelineEvent
) => void;
export type RangeChangeEvent = (
  start: number,
  end: number,
  event: TimelineEvent
) => void;

// =====================================
// Shared Context
// =====================================
interface LayerTrackContext {
  layerId: string;
  trackId: string;
}

// =====================================
// Drag Events (all include range + context)
// =====================================
export type DragStartArgs = WithRange<
  { event: TimelineMouseEvent } & LayerTrackContext
>;
export type DragMoveArgs = WithRange<LayerTrackContext>;
export type DragEndArgs = WithRange<LayerTrackContext>;

export type DragStartEvent = (args: DragStartArgs) => void;
export type DragMoveEvent = (args: DragMoveArgs) => void;
export type DragEndEvent = (args: DragEndArgs) => void;

// =====================================
// Resize Events
// =====================================
export type ResizeStartArgs = WithRange<
  { event: TimelineMouseEvent; side: ResizeSide } & LayerTrackContext
>;
export type ResizeArgs = WithRange<LayerTrackContext>;
export type ResizeEndArgs = WithRange<LayerTrackContext>;

export type ResizeStartEvent = (args: ResizeStartArgs) => void;
export type ResizeEvent = (args: ResizeArgs) => void;
export type ResizeEndEvent = (args: ResizeEndArgs) => void;

// =====================================
// Move Events
// =====================================
export type MoveStartEvent = (event: TimelineMouseEvent) => void;
export type MoveEvent = (position: number, event: TimelineEvent) => void;
export type MoveEndEvent = (event: TimelineMouseEvent) => void;

// =====================================
// Selection Event
// =====================================
export type SelectionEvent = (id: string, event: TimelineEvent) => void;

// =====================================
// Reorder Event
// =====================================
export type ReorderEvent = (
  reorderedIds: string[],
  movedId: string,
  fromIndex: number,
  toIndex: number
) => void;

// =====================================
// Utility Types
// =====================================
export type WithRange<T = {}> = T & { start: number; end: number };
