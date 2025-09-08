interface ConstraintContext {
  currentTime: number;
  leftHandlePosition: number;
  rightHandlePosition: number;
  min: number;
  max: number;
  tracks: Map<string, TrackContextValue>;
  currentTrackId?: string;
}

interface LayerConstraintContext {
  allLayers: LayerContextValue[];
  currentLayer: LayerContextValue;
  tracks: Map<string, TrackContextValue>;
  timeline: TimelineContextValue;
}

interface TimelineRootProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  currentTime?: number;
  defaultCurrentTime?: number;
  onTimeChange?: (time: number, e: React.SyntheticEvent) => void;
  timelineBounds?: number;
  zoom?: number;
  defaultZoom?: number;
  onZoomChange?: (zoom: number) => void;
  step?: number;
  minGap?: number;
  constraints?: {
    leftHandle?: (position: number, context: ConstraintContext) => number;
    rightHandle?: (position: number, context: ConstraintContext) => number;
    playhead?: (position: number, context: ConstraintContext) => number;
  };
  onPlay?: (e: React.SyntheticEvent) => void;
  onPause?: (e: React.SyntheticEvent) => void;
  onSeek?: (time: number, e: React.SyntheticEvent) => void;
  orientation?: "horizontal" | "vertical";
  scaleConfig?:
    | {
        type: "fixed";
        fixedPxPerSecond: number;
      }
    | {
        type: "container";
      }
    | {
        type: "auto";
        fixedPxPerSecond: number;
        minPxPerSecond?: number;
        maxPxPerSecond?: number;
      };
  autoScrollConfig?: {
    edgeThreshold?: number;
    maxScrollSpeed?: number;
    acceleration?: number;
    activationMargin?: number;
  };
}

interface TimelineContextValue {
  min: number;
  max: number;

  // User configuration
  timelineBounds: number;
  zoom: number;

  // Core state
  currentTime: number;
  step: number;
  orientation: "horizontal" | "vertical";

  // Constraints
  minGap: number;
  constraints?: {
    leftHandle?: (position: number, context: ConstraintContext) => number;
    rightHandle?: (position: number, context: ConstraintContext) => number;
    playhead?: (position: number, context: ConstraintContext) => number;
  };

  // Track management
  tracks: Map<string, Track>;
  registerTrack: (id: string, track: TrackContextValue) => void;
  unregisterTrack: (id: string) => void;
  getTrackAtPosition: (x: number, y: number) => string | null;

  // Dynamic bounds calculation
  recalculateBounds: () => void;

  // Zoom functionality
  setZoom: (zoom: number) => void;

  // Refs
  containerRef: React.RefObject<HTMLDivElement | null>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  leftHandleRef: React.RefObject<HTMLDivElement | null>;
  rightHandleRef: React.RefObject<HTMLDivElement | null>;
  playheadRef: React.RefObject<HTMLDivElement | null>;

  // Accessibility
  timelineId: string;
  instructionsId: string;
  announceChange: (message: string) => void;
  focusPlayhead: () => void;
  focusLeftHandle: () => void;
  focusRightHandle: () => void;

  // Scale utilities
  pxPerMsRef: React.RefObject<number>;
  recalcScale: () => void;

  // Internal utilities
  msToPixels: (ms: number) => number;
  pixelsToMs: (px: number) => number;
  clampTime: (time: number) => number;

  // Auto scroll
  handleAutoScroll: (event: MouseEvent) => void;
  startAutoScroll: (
    container: HTMLDivElement | null,
    onScrollChange?: (
      scrollDelta: { x: number; y: number },
      currentScroll: { x: number; y: number }
    ) => void
  ) => void;
  stopAutoScroll: () => void;

  // Event handlers
  onTimeChange?: (time: number, e: React.SyntheticEvent) => void;
  onPlay?: (e: React.SyntheticEvent) => void;
  onPause?: (e: React.SyntheticEvent) => void;
  onSeek?: (time: number, e: React.SyntheticEvent) => void;

  // Handle positions for constraints
  leftHandlePosition: number;
  rightHandlePosition: number;
  setLeftHandlePosition: (pos: number) => void;
  setRightHandlePosition: (pos: number) => void;
}

interface TrackContextValue {
  id: string;
  label?: string;
  selected?: boolean;
  onSelect?: (id: string, e: React.MouseEvent) => void;
  onConstrainLayer?: (
    layerId: string,
    proposedStart: number,
    proposedEnd: number,
    context: LayerConstraintContext
  ) => { start: number; end: number };

  ref: React.RefObject<HTMLElement | null>;

  // Layer management
  layers: Map<string, LayerContextValue>;
  registerLayer: (id: string, layer: LayerContextValue) => void;
  unregisterLayer: (id: string) => void;
}

interface Track extends TrackContextValue {
  yPosition?: number;
  isBeingDragged?: boolean;
}

interface LayerContextValue {
  id: string;
  start: number;
  end: number;
  onResizeStart?: (e: React.MouseEvent) => void;
  onResize?: (start: number, end: number, e: React.MouseEvent) => void;
  onResizeEnd?: (e: React.MouseEvent) => void;

  // Tooltip state
  tooltipState: {
    showTooltip: boolean;
    mousePosition: { x: number; y: number };
  };
}

// Track Provider
interface TrackProviderProps {
  children: React.ReactNode;
  id?: string;
  label?: string;
  selected?: boolean;
  onSelect?: (id: string, e: React.MouseEvent | React.KeyboardEvent) => void;
  onConstrainLayer?: (
    layerId: string,
    proposedStart: number,
    proposedEnd: number,
    context: LayerConstraintContext
  ) => { start: number; end: number };
  ref?: React.RefObject<HTMLDivElement | null>;
}

// Timeline Reorder Context
interface ReorderContextValue {
  dragState: {
    draggedTrackId: string | null;
    dragOverTrackId: string | null;
    isDragging: boolean;
    overlayPosition: { x: number; y: number };
  };
  draggedTrack: TrackContextValue | null;
  dragOverTrack: TrackContextValue | null;
  handleTrackDragStart: (trackId: string, e: React.MouseEvent) => void;
  orderedTrackIds: string[];
}

export type {
  ConstraintContext,
  LayerContextValue,
  LayerConstraintContext,
  TrackProviderProps,
  Track,
  TimelineContextValue,
  TimelineRootProps,
  TrackContextValue,
  ReorderContextValue,
};
