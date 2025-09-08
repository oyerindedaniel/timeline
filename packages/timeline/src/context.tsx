"use client";

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
import { useComposableState } from "./hooks";
import { generateTimelineId } from "./utils/generate-id";
import type {
  LayerContextValue,
  Track,
  TimelineContextValue,
  TimelineRootProps,
  TrackContextValue,
  TrackProviderProps,
  ReorderContextValue,
} from "./types";

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

export function TimelineRootProvider({
  children,
  currentTime: controlledTime,
  defaultCurrentTime = 0,
  onTimeChange,
  timelineBounds = Infinity,
  zoom: controlledZoom,
  defaultZoom = 1,
  onZoomChange,
  step = 100,
  minGap = 1000,
  constraints,
  onPlay,
  onPause,
  onSeek,
  orientation = "horizontal",
  scaleConfig,
  autoScrollConfig,
}: TimelineRootProps) {
  const DEFAULT_TIMELINE_MAX = 100_000;

  const [currentTime, setCurrentTime] = useComposableState({
    defaultValue: defaultCurrentTime,
    controlled: controlledTime,
    onChange: onTimeChange,
  });

  const [zoom, setZoom] = useComposableState({
    defaultValue: defaultZoom,
    controlled: controlledZoom,
    onChange: onZoomChange,
  });

  const [announcement, setAnnouncement] = useState("");
  const [leftHandlePosition, setLeftHandlePosition] = useState(0);
  const [rightHandlePosition, setRightHandlePosition] =
    useState(DEFAULT_TIMELINE_MAX);

  const [min] = useState(0);
  const [max, setMax] = useState(DEFAULT_TIMELINE_MAX);

  const finalMax = Math.max(
    max,
    timelineBounds === Infinity ? max : timelineBounds
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const leftHandleRef = useRef<HTMLDivElement | null>(null);
  const rightHandleRef = useRef<HTMLDivElement | null>(null);
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const announcementRef = useRef<HTMLDivElement>(null);

  const timelineId = useId();
  const instructionsId = useId();

  const tracks = useLazyRef(() => new Map<string, Track>());

  const defaultScaleConfig = {
    type: "auto" as const,
    fixedPxPerSecond: 50 * zoom,
    maxPxPerSecond: 100 * zoom,
  };

  const finalScaleConfig = scaleConfig
    ? {
        ...scaleConfig,
        ...(scaleConfig.type !== "container" && {
          fixedPxPerSecond: (scaleConfig.fixedPxPerSecond || 50) * zoom,
          ...(scaleConfig.type === "auto" && {
            maxPxPerSecond: (scaleConfig.maxPxPerSecond || 100) * zoom,
          }),
        }),
      }
    : defaultScaleConfig;

  const { pxPerMsRef, recalc } = useScale({
    containerRef,
    durationMs: finalMax,
    ...finalScaleConfig,
  });

  const defaultAutoScrollConfig = {
    edgeThreshold: 30,
    maxScrollSpeed: 10,
    acceleration: 1.2,
    activationMargin: 50,
  };

  const finalAutoScrollConfig = autoScrollConfig ?? defaultAutoScrollConfig;
  const { handleAutoScroll, startAutoScroll, stopAutoScroll } = useAutoScroll(
    finalAutoScrollConfig
  );

  const recalculateBounds = useCallback(() => {
    let maxDuration = DEFAULT_TIMELINE_MAX;

    for (const track of tracks.current.values()) {
      for (const layer of track.layers.values()) {
        maxDuration = Math.max(maxDuration, layer.end);
      }
    }

    setMax(maxDuration);

    requestAnimationFrame(() => {
      recalc();
    });
  }, [recalc]);

  const getTrackAtPosition = useCallback(
    (x: number, y: number): string | null => {
      const container = containerRef.current;
      if (!container) return null;

      const containerRect = container.getBoundingClientRect();
      const relativeY = y - containerRect.top;

      let closestTrack: string | null = null;
      let closestDistance = Infinity;

      for (const [trackId, trackData] of tracks.current.entries()) {
        if (trackData.yPosition !== undefined) {
          const distance = Math.abs(trackData.yPosition - relativeY);
          if (distance < closestDistance) {
            closestDistance = distance;
            closestTrack = trackId;
          }
        }
      }

      return closestTrack;
    },
    []
  );

  const registerTrack = useCallback(
    (id: string, track: TrackContextValue) => {
      const extendedTrack: Track = {
        ...track,
        yPosition: 0,
        isBeingDragged: false,
      };
      tracks.current.set(id, extendedTrack);
      recalculateBounds();
    },
    [recalculateBounds]
  );

  const unregisterTrack = useCallback(
    (id: string) => {
      tracks.current.delete(id);
      recalculateBounds();
    },
    [recalculateBounds]
  );

  const announceChange = useCallback((message: string) => {
    setAnnouncement(message);
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
      const clampedTime = Math.max(min, Math.min(finalMax, time));
      setCurrentTime(clampedTime, e);
      announceChange(`Time changed to ${formatDurationDisplay(clampedTime)}`);
    },
    [min, finalMax, setCurrentTime, announceChange]
  );

  const msToPixels = useCallback((ms: number) => ms * pxPerMsRef.current, []);
  const pixelsToMs = useCallback((px: number) => px / pxPerMsRef.current, []);
  const clampTime = useCallback(
    (time: number) => Math.max(min, Math.min(finalMax, time)),
    [min, finalMax]
  );

  React.useEffect(() => {
    recalc();
  }, [zoom, recalc]);

  React.useEffect(() => {
    if (announcementRef.current && announcement) {
      announcementRef.current.textContent = announcement;
    }
  }, [announcement]);

  const contextValue: TimelineContextValue = useMemo(
    () => ({
      min,
      max: finalMax,
      timelineBounds,
      zoom,
      setZoom,
      currentTime,
      step,
      minGap,
      constraints,
      orientation,
      tracks: tracks.current,
      registerTrack,
      unregisterTrack,
      getTrackAtPosition,
      recalculateBounds,
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
      onPlay,
      onPause,
      onSeek,
      msToPixels,
      pixelsToMs,
      clampTime,
      leftHandlePosition,
      rightHandlePosition,
      setLeftHandlePosition: (pos: number) =>
        setLeftHandlePosition(Math.max(0, pos)),
      setRightHandlePosition,
    }),
    [
      min,
      finalMax,
      timelineBounds,
      zoom,
      setZoom,
      currentTime,
      step,
      minGap,
      constraints,
      orientation,
      registerTrack,
      unregisterTrack,
      getTrackAtPosition,
      recalculateBounds,
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
      onPlay,
      onPause,
      onSeek,
      msToPixels,
      pixelsToMs,
      clampTime,
      leftHandlePosition,
      rightHandlePosition,
    ]
  );

  return (
    <TimelineContext.Provider value={contextValue}>
      {children}
      <div
        ref={announcementRef}
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />
    </TimelineContext.Provider>
  );
}

export function TrackProvider({
  children,
  id: providedId,
  label,
  selected,
  onSelect,
  onConstrainLayer,
  ref,
}: TrackProviderProps) {
  const timeline = useTimelineContext();
  const layers = useLazyRef(() => new Map<string, LayerContextValue>());

  const id = providedId ?? generateTimelineId("track");

  const stableOnSelect = useStableHandler(onSelect);
  const stableOnConstrainLayer = useStableHandler(onConstrainLayer);

  const registerLayer = useCallback(
    (layerId: string, layer: LayerContextValue) => {
      layers.current.set(layerId, layer);
      timeline.recalculateBounds();
    },
    [timeline]
  );

  const unregisterLayer = useCallback(
    (layerId: string) => {
      layers.current.delete(layerId);
      timeline.recalculateBounds();
    },
    [timeline]
  );

  const contextValue: TrackContextValue = useMemo(
    () => ({
      id,
      label,
      selected,
      onSelect: stableOnSelect,
      onConstrainLayer: stableOnConstrainLayer,
      ref: ref || { current: null },
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
      ref,
      registerLayer,
      unregisterLayer,
    ]
  );

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
  id?: string;
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
  id: providedId,
  start: rawStart,
  end,
  onResizeStart,
  onResize,
  onResizeEnd,
  tooltipState,
}: LayerProviderProps) {
  const track = useTrackContext();

  const id = providedId ?? generateTimelineId("layer");
  const start = Math.max(0, rawStart);

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

export const ReorderContext = createContext<ReorderContextValue | null>(null);

export function useReorderContext() {
  const context = useContext(ReorderContext);
  if (!context) {
    throw new Error("Reorder components must be wrapped in <Timeline.Reorder>");
  }
  return context;
}
