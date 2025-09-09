export type TimelineMouseEvent = React.MouseEvent;
export type TimelineKeyboardEvent = React.KeyboardEvent;
export type TimelineEvent = TimelineMouseEvent | TimelineKeyboardEvent;

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

interface LayerTrackContext {
  layerId: string;
  trackId: string;
}

interface TimelineEventContext extends LayerTrackContext {
  event: TimelineEvent;
}

interface TimelineMouseEventContext extends LayerTrackContext {
  event: TimelineMouseEvent;
}

export interface DragStartArgs extends TimelineMouseEventContext {}
export interface DragMoveArgs extends TimelineEventContext {
  start: number;
  end: number;
}
export interface DragEndArgs extends TimelineMouseEventContext {}

export type DragStartEvent = (args: DragStartArgs) => void;
export type DragMoveEvent = (args: DragMoveArgs) => void;
export type DragEndEvent = (args: DragEndArgs) => void;

export interface ResizeStartArgs extends TimelineMouseEventContext {}
export interface ResizeArgs extends TimelineEventContext {
  start: number;
  end: number;
}
export interface ResizeEndArgs extends TimelineMouseEventContext {}

export type ResizeStartEvent = (args: ResizeStartArgs) => void;
export type ResizeEvent = (args: ResizeArgs) => void;
export type ResizeEndEvent = (args: ResizeEndArgs) => void;

export type MoveStartEvent = (event: TimelineMouseEvent) => void;
export type MoveEvent = (position: number, event: TimelineEvent) => void;
export type MoveEndEvent = (event: TimelineMouseEvent) => void;

export type SelectionEvent = (id: string, event: TimelineEvent) => void;

export type ReorderEvent = (
  reorderedIds: string[],
  movedId: string,
  fromIndex: number,
  toIndex: number
) => void;

export type ResizeHandleStartEvent = (
  event: TimelineMouseEvent,
  side: "left" | "right"
) => void;
