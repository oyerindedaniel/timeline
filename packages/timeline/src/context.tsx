import React, {
  createContext,
  useContext,
  useRef,
  useCallback,
  useState,
  useMemo,
  useId,
} from "react";
import { useAutoScroll } from "./timeline-hooks/use-auto-scroll";
import { useScale } from "./timeline-hooks/use-scale";
import { useLazyRef } from "./hooks/use-lazy-ref";
import { useStableHandler } from "./hooks/use-stable-handler";
import { formatDurationDisplay } from "./utils/display";

export interface ConstraintContext {
  currentTime: number;
  leftHandlePosition: number;
  rightHandlePosition: number;
  min: number;
  max: number;
  tracks: Map<string, TrackContextValue>;
  currentTrackId?: string;
}

export interface LayerConstraintContext {
  allLayers: LayerContextValue[];
  currentLayer: LayerContextValue;
  tracks: Map<string, TrackContextValue>;
  timeline: TimelineContextValue;
}

export interface TimelineContextValue {
  // Core state
  currentTime: number;
  min: number;
  max: number;
  step: number;
  orientation: "horizontal" | "vertical";

  // Constraints
  minGap: number;
  constraints?: {
    leftHandle?: (position: number, context: ConstraintContext) => number;
    rightHandle?: (position: number, context: ConstraintContext) => number;
    playhead?: (position: number, context: ConstraintContext) => number;
  };

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
    onScrollChange?: (scrollDelta: number, currentScrollLeft: number) => void
  ) => void;
  stopAutoScroll: () => void;

  // Event handlers
  onTimeChange?: (time: number, e: React.SyntheticEvent) => void;
  onPlay?: (e: React.SyntheticEvent) => void;
  onPause?: (e: React.SyntheticEvent) => void;
  onSeek?: (time: number, e: React.SyntheticEvent) => void;

  // Track management
  tracks: Map<string, TrackContextValue>;
  registerTrack: (id: string, track: TrackContextValue) => void;
  unregisterTrack: (id: string) => void;

  // Handle positions for constraints
  leftHandlePosition: number;
  rightHandlePosition: number;
  setLeftHandlePosition: (pos: number) => void;
  setRightHandlePosition: (pos: number) => void;
}

export interface TrackContextValue {
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

  // Layer management
  layers: Map<string, LayerContextValue>;
  registerLayer: (id: string, layer: LayerContextValue) => void;
  unregisterLayer: (id: string) => void;
}

export interface LayerContextValue {
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

const TimelineContext = createContext<TimelineContextValue | null>(null);
const TrackContext = createContext<TrackContextValue | null>(null);
const LayerContext = createContext<LayerContextValue | null>(null);

export function useTimelineContext() {
  const context = useContext(TimelineContext);
  if (!context) {
    throw new Error("Timeline components must be wrapped in <Timeline.Root>");
  }
  return context;
}

export function useTrackContext() {
  const context = useContext(TrackContext);
  if (!context) {
    throw new Error("Track components must be wrapped in <Timeline.Track>");
  }
  return context;
}

export function useLayerContext() {
  const context = useContext(LayerContext);
  if (!context) {
    throw new Error(
      "Layer components must be wrapped in <Timeline.Track.Layer>"
    );
  }
  return context;
}

interface TimelineRootProps {
  children: React.ReactNode;
  currentTime?: number;
  defaultCurrentTime?: number;
  onTimeChange?: (time: number, e: React.SyntheticEvent) => void;
  min?: number;
  max?: number;
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
}

export function TimelineRootProvider({
  children,
  currentTime: controlledTime,
  defaultCurrentTime = 0,
  onTimeChange,
  min = 0,
  max = 100000,
  step = 100,
  minGap = 1000,
  constraints,
  onPlay,
  onPause,
  onSeek,
  orientation = "horizontal",
}: TimelineRootProps) {
  const [internalTime, setInternalTime] = useState(defaultCurrentTime);
  const [leftHandlePosition, setLeftHandlePosition] = useState(0);
  const [rightHandlePosition, setRightHandlePosition] = useState(max);
  const [announcement, setAnnouncement] = useState("");

  const currentTime = controlledTime ?? internalTime;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const leftHandleRef = useRef<HTMLDivElement | null>(null);
  const rightHandleRef = useRef<HTMLDivElement | null>(null);
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const announcementRef = useRef<HTMLDivElement>(null);

  const timelineId = useId();
  const instructionsId = useId();

  const { pxPerMsRef, recalc } = useScale({
    containerRef,
    durationMs: max,
    type: "auto",
    fixedPxPerSecond: 50,
    maxPxPerSecond: 100,
  });

  const { handleAutoScroll, startAutoScroll, stopAutoScroll } = useAutoScroll({
    edgeThreshold: 30,
    maxScrollSpeed: 10,
    acceleration: 1.2,
  });

  const tracks = useLazyRef(() => new Map<string, TrackContextValue>());

  const stableOnTimeChange = useStableHandler(onTimeChange);
  const stableOnPlay = useStableHandler(onPlay);
  const stableOnPause = useStableHandler(onPause);
  const stableOnSeek = useStableHandler(onSeek);

  const announceChange = useCallback((message: string) => {
    setAnnouncement(message);
    // Clear announcement after it is read
    setTimeout(() => setAnnouncement(""), 100);
  }, []);

  const focusPlayhead = useCallback(() => {
    playheadRef.current?.focus();
    announceChange("Playhead focused");
  }, [announceChange]);

  const focusLeftHandle = useCallback(() => {
    leftHandleRef.current?.focus();
    announceChange("Left trim handle focused");
  }, [announceChange]);

  const focusRightHandle = useCallback(() => {
    rightHandleRef.current?.focus();
    announceChange("Right trim handle focused");
  }, [announceChange]);

  const handleTimeChange = useCallback(
    (time: number, e: React.SyntheticEvent) => {
      const clampedTime = Math.max(min, Math.min(max, time));
      if (controlledTime === undefined) {
        setInternalTime(clampedTime);
      }
      stableOnTimeChange?.(clampedTime, e);
      announceChange(`Time changed to ${formatDurationDisplay(clampedTime)}`);
    },
    [min, max, controlledTime, stableOnTimeChange, announceChange]
  );

  const msToPixels = useCallback((ms: number) => ms * pxPerMsRef.current, []);
  const pixelsToMs = useCallback((px: number) => px / pxPerMsRef.current, []);
  const clampTime = useCallback(
    (time: number) => Math.max(min, Math.min(max, time)),
    [min, max]
  );

  const registerTrack = useCallback((id: string, track: TrackContextValue) => {
    tracks.current.set(id, track);
  }, []);

  const unregisterTrack = useCallback((id: string) => {
    tracks.current.delete(id);
  }, []);

  React.useEffect(() => {
    if (announcementRef.current && announcement) {
      announcementRef.current.textContent = announcement;
    }
  }, [announcement]);

  const contextValue: TimelineContextValue = useMemo(
    () => ({
      currentTime,
      min,
      max,
      step,
      minGap,
      constraints,
      orientation,
      containerRef,
      scrollContainerRef,
      leftHandleRef,
      rightHandleRef,
      playheadRef,
      timelineId,
      instructionsId,
      announceChange,
      focusPlayhead,
      focusLeftHandle,
      focusRightHandle,
      pxPerMsRef,
      recalcScale: recalc,
      handleAutoScroll,
      startAutoScroll,
      stopAutoScroll,
      onTimeChange: handleTimeChange,
      onPlay: stableOnPlay,
      onPause: stableOnPause,
      onSeek: stableOnSeek,
      msToPixels,
      pixelsToMs,
      clampTime,
      tracks: tracks.current,
      registerTrack,
      unregisterTrack,
      leftHandlePosition,
      rightHandlePosition,
      setLeftHandlePosition,
      setRightHandlePosition,
    }),
    [
      currentTime,
      min,
      max,
      step,
      minGap,
      constraints,
      orientation,
      timelineId,
      instructionsId,
      announceChange,
      focusPlayhead,
      focusLeftHandle,
      focusRightHandle,
      recalc,
      handleAutoScroll,
      startAutoScroll,
      stopAutoScroll,
      handleTimeChange,
      stableOnPlay,
      stableOnPause,
      stableOnSeek,
      msToPixels,
      pixelsToMs,
      clampTime,
      registerTrack,
      unregisterTrack,
      leftHandlePosition,
      rightHandlePosition,
    ]
  );

  return (
    <TimelineContext.Provider value={contextValue}>
      {children}
      {/* Live region for announcements */}
      <div
        ref={announcementRef}
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />
    </TimelineContext.Provider>
  );
}

// Track Provider
interface TrackProviderProps {
  children: React.ReactNode;
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
}

export function TrackProvider({
  children,
  id,
  label,
  selected,
  onSelect,
  onConstrainLayer,
}: TrackProviderProps) {
  const timeline = useTimelineContext();
  const layers = useLazyRef(() => new Map<string, LayerContextValue>());

  const stableOnSelect = useStableHandler(onSelect);
  const stableOnConstrainLayer = useStableHandler(onConstrainLayer);

  const registerLayer = useCallback(
    (layerId: string, layer: LayerContextValue) => {
      layers.current.set(layerId, layer);
    },
    []
  );

  const unregisterLayer = useCallback((layerId: string) => {
    layers.current.delete(layerId);
  }, []);

  const contextValue: TrackContextValue = useMemo(
    () => ({
      id,
      label,
      selected,
      onSelect: stableOnSelect,
      onConstrainLayer: stableOnConstrainLayer,
      layers: layers.current,
      registerLayer,
      unregisterLayer,
    }),
    [
      id,
      label,
      selected,
      stableOnSelect,
      stableOnConstrainLayer,
      registerLayer,
      unregisterLayer,
    ]
  );

  // Register/unregister with timeline
  React.useEffect(() => {
    timeline.registerTrack(id, contextValue);
    return () => timeline.unregisterTrack(id);
  }, [id, contextValue, timeline]);

  return (
    <TrackContext.Provider value={contextValue}>
      {children}
    </TrackContext.Provider>
  );
}

// Layer Provider
interface LayerProviderProps {
  children: React.ReactNode;
  id: string;
  start: number;
  end: number;
  onResizeStart?: (e: React.MouseEvent) => void;
  onResize?: (start: number, end: number, e: React.MouseEvent) => void;
  onResizeEnd?: (e: React.MouseEvent) => void;
  tooltipState: {
    showTooltip: boolean;
    mousePosition: { x: number; y: number };
  };
}

export function LayerProvider({
  children,
  id,
  start,
  end,
  onResizeStart,
  onResize,
  onResizeEnd,
  tooltipState,
}: LayerProviderProps) {
  const track = useTrackContext();

  const stableOnResizeStart = useStableHandler(onResizeStart);
  const stableOnResize = useStableHandler(onResize);
  const stableOnResizeEnd = useStableHandler(onResizeEnd);

  const contextValue: LayerContextValue = useMemo(
    () => ({
      id,
      start,
      end,
      onResizeStart: stableOnResizeStart,
      onResize: stableOnResize,
      onResizeEnd: stableOnResizeEnd,
      tooltipState,
    }),
    [
      id,
      start,
      end,
      stableOnResizeStart,
      stableOnResize,
      stableOnResizeEnd,
      tooltipState,
    ]
  );

  // Register/unregister with track
  React.useEffect(() => {
    track.registerLayer(id, contextValue);
    return () => track.unregisterLayer(id);
  }, [id, contextValue, track]);

  return (
    <LayerContext.Provider value={contextValue}>
      {children}
    </LayerContext.Provider>
  );
}
