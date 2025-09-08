"use client";

import React, {
  forwardRef,
  useRef,
  useCallback,
  useEffect,
  useState,
  useId,
  useMemo,
} from "react";
import { createPortal, flushSync } from "react-dom";
import { cn } from "./utils/cn";
import {
  TimelineRootProvider,
  TrackProvider,
  LayerProvider,
  useLayerContext,
  useTimelineContext,
  useTrackContext,
  ReorderContext,
  useReorderContext,
} from "./context";
import { useComposedRefs, useStableHandler } from "./hooks";
import { formatDurationDisplay } from "./utils/display";
import {
  renderTimelineRuler,
  renderTimelineStrips,
  getScrollState,
} from "./utils/timeline-utils";
import { Slot } from "./utils/primitives";

import { GripVertical } from "./icons";
import { generateTimelineId } from "./utils/generate-id";
import { useAutoScroll } from "./timeline-hooks/use-auto-scroll";
import type {
  ConstraintContext,
  LayerConstraintContext,
  ReorderContextValue,
  TimelineContextValue,
  TimelineRootProps,
  TrackContextValue,
} from "./types";

type AsChildProps<DefaultElementProps> =
  | ({ asChild?: false } & DefaultElementProps)
  | ({ asChild: true; children: React.ReactElement } & Omit<
      DefaultElementProps,
      "children"
    >);

const TimelineRoot = forwardRef<HTMLDivElement, TimelineRootProps>(
  (
    {
      children,
      currentTime,
      defaultCurrentTime = 0,
      onTimeChange,
      timelineBounds,
      step = 100,
      minGap = 1000,
      constraints,
      onPlay,
      onPause,
      onSeek,
      orientation = "horizontal",
      className,
      ...props
    },
    ref
  ) => {
    const timelineId = useId();
    const instructionsId = useId();

    return (
      <TimelineRootProvider
        currentTime={currentTime}
        defaultCurrentTime={defaultCurrentTime}
        onTimeChange={onTimeChange}
        timelineBounds={timelineBounds}
        step={step}
        minGap={minGap}
        constraints={constraints}
        onPlay={onPlay}
        onPause={onPause}
        onSeek={onSeek}
        orientation={orientation}
      >
        <div
          ref={ref}
          role="application"
          aria-label="Timeline editor"
          aria-describedby={instructionsId}
          className={cn(
            "flex bg-yellow-500 relative flex-col gap-2 w-full focus-within:outline-none",
            className
          )}
          {...props}
        >
          <div id={instructionsId} className="sr-only">
            Timeline editor. Use arrow keys to navigate. Space to play/pause.
            Tab to move between controls. Drag handles to trim timeline. Drag
            layers to resize. Left and right arrows move playhead by {step}ms,
            hold shift for fine control.
          </div>
          {children}
        </div>
      </TimelineRootProvider>
    );
  }
);
TimelineRoot.displayName = "Timeline.Root";

interface TimelineContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const TimelineContent = forwardRef<HTMLDivElement, TimelineContentProps>(
  ({ children, className, onKeyDown, ...props }, ref) => {
    const {
      scrollContainerRef,
      containerRef,
      max,
      pxPerMsRef,
      currentTime,
      onTimeChange,
      onPlay,
      onPause,
      announceChange,
      focusPlayhead,
      focusLeftHandle,
      focusRightHandle,
    } = useTimelineContext();

    const composedScrollRef = useComposedRefs(ref, scrollContainerRef);
    const pxPerSecond = pxPerMsRef.current * 1000;

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        switch (e.key) {
          case " ":
            e.preventDefault();
            if (e.shiftKey) {
              onPause?.(e);
              announceChange("Timeline paused");
            } else {
              onPlay?.(e);
              announceChange("Timeline playing");
            }
            break;
          case "Home":
            e.preventDefault();
            onTimeChange?.(0, e);
            break;
          case "End":
            e.preventDefault();
            onTimeChange?.(max, e);
            break;
          case "p":
          case "P":
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              focusPlayhead();
            }
            break;
          case "[":
            e.preventDefault();
            focusLeftHandle();
            break;
          case "]":
            e.preventDefault();
            focusRightHandle();
            break;
          default:
            break;
        }

        onKeyDown?.(e);
      },
      [
        onPlay,
        onPause,
        onTimeChange,
        max,
        announceChange,
        focusPlayhead,
        focusLeftHandle,
        focusRightHandle,
        onKeyDown,
      ]
    );

    return (
      <div
        ref={composedScrollRef}
        role="region"
        aria-label="Timeline content"
        aria-live="polite"
        aria-atomic="false"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className={cn(
          "relative w-full rounded-md bg-surface-secondary overflow-x-auto overflow-y-hidden focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
          className
        )}
        {...props}
      >
        <div
          ref={containerRef}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={currentTime}
          aria-valuetext={`Current time: ${formatDurationDisplay(currentTime)}`}
          className="relative min-w-full"
          style={{
            width: `${(max / 1000) * pxPerSecond}px`,
          }}
        >
          {children}
        </div>
      </div>
    );
  }
);
TimelineContent.displayName = "Timeline.Content";

// Timeline Ruler
interface TimelineRulerProps extends React.HTMLAttributes<HTMLDivElement> {
  tickInterval?: number;
  renderTick?: (time: number) => React.ReactNode;
}

const TimelineRuler = forwardRef<HTMLDivElement, TimelineRulerProps>(
  ({ tickInterval, renderTick, className, ...props }, ref) => {
    const { max, pxPerMsRef } = useTimelineContext();
    const rulerRef = useRef<HTMLDivElement>(null);
    const composedRef = useComposedRefs(ref, rulerRef);
    const rulerId = useId();

    const drawRuler = useCallback(() => {
      const pxPerMs = pxPerMsRef.current;
      if (pxPerMs <= 0) return;

      renderTimelineRuler({
        pxPerMs,
        durationMs: max,
        container: rulerRef.current,
      });
    }, [max, pxPerMsRef]);

    useEffect(() => {
      drawRuler();
    }, [drawRuler]);

    return (
      <div
        ref={composedRef}
        role="img"
        aria-labelledby={`${rulerId}-label`}
        className={cn("absolute inset-x-0 top-0 h-5", className)}
        {...props}
      >
        <div id={`${rulerId}-label`} className="sr-only">
          Timeline ruler showing time markers from 0 to{" "}
          {formatDurationDisplay(max)}
        </div>
      </div>
    );
  }
);
TimelineRuler.displayName = "Timeline.Ruler";

// Timeline Playhead
interface TimelinePlayheadProps extends React.HTMLAttributes<HTMLDivElement> {
  draggable?: boolean;
  onMove?: (time: number, e: React.MouseEvent | React.KeyboardEvent) => void;
  onMoveStart?: (e: React.MouseEvent) => void;
  onMoveEnd?: (e: React.MouseEvent) => void;
}

const TimelinePlayhead = forwardRef<HTMLDivElement, TimelinePlayheadProps>(
  (
    {
      draggable = true,
      onMove,
      onMoveStart,
      onMoveEnd,
      className,
      onMouseDown,
      onKeyDown,
      ...props
    },
    ref
  ) => {
    const {
      currentTime,
      min,
      max,
      step,
      msToPixels,
      pixelsToMs,
      containerRef,
      scrollContainerRef,
      playheadRef,
      handleAutoScroll,
      startAutoScroll,
      stopAutoScroll,
      onTimeChange,
      announceChange,
      constraints,
      leftHandlePosition,
      rightHandlePosition,
      tracks,
    } = useTimelineContext();

    const composedRef = useComposedRefs(ref, playheadRef);
    const draggingRef = useRef(false);
    const playheadId = useId();

    const stableOnMove = useStableHandler(onMove);
    const stableOnMoveStart = useStableHandler(onMoveStart);
    const stableOnMoveEnd = useStableHandler(onMoveEnd);

    const applyPlayheadConstraints = useCallback(
      (proposedTime: number): number => {
        let constrainedTime = Math.max(min, Math.min(max, proposedTime));

        if (constraints?.playhead) {
          const constraintContext: ConstraintContext = {
            currentTime: constrainedTime,
            leftHandlePosition,
            rightHandlePosition,
            min,
            max,
            tracks,
            currentTrackId: undefined,
          };

          constrainedTime = constraints.playhead(
            constrainedTime,
            constraintContext
          );

          constrainedTime = Math.max(min, Math.min(max, constrainedTime));
        }

        return constrainedTime;
      },
      [
        constraints,
        min,
        max,
        currentTime,
        leftHandlePosition,
        rightHandlePosition,
        tracks,
      ]
    );

    useEffect(() => {
      if (playheadRef.current && !draggingRef.current) {
        const position = msToPixels(currentTime);
        playheadRef.current.style.left = `${position}px`;
      }
    }, [currentTime, msToPixels]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        const fineStep = step / 10;
        const moveStep = e.shiftKey ? fineStep : step;

        switch (e.key) {
          case "ArrowLeft":
            e.preventDefault();
            const newTimeLeft = currentTime - moveStep;
            const constrainedLeft = applyPlayheadConstraints(newTimeLeft);

            stableOnMove?.(constrainedLeft, e);
            onTimeChange?.(constrainedLeft, e);
            announceChange(
              `Playhead moved to ${formatDurationDisplay(constrainedLeft)}`
            );
            break;
          case "ArrowRight":
            e.preventDefault();
            const newTimeRight = currentTime + moveStep;
            const constrainedRight = applyPlayheadConstraints(newTimeRight);

            stableOnMove?.(constrainedRight, e);
            onTimeChange?.(constrainedRight, e);
            announceChange(
              `Playhead moved to ${formatDurationDisplay(constrainedRight)}`
            );
            break;
          case "Home":
            e.preventDefault();
            const constrainedHome = applyPlayheadConstraints(min);
            stableOnMove?.(constrainedHome, e);
            onTimeChange?.(constrainedHome, e);
            announceChange(`Playhead moved to start`);
            break;
          case "End":
            e.preventDefault();
            const constrainedEnd = applyPlayheadConstraints(max);
            stableOnMove?.(constrainedEnd, e);
            onTimeChange?.(constrainedEnd, e);
            announceChange(`Playhead moved to end`);
            break;
          case "Enter":
          case " ":
            e.preventDefault();
            announceChange(`Playhead at ${formatDurationDisplay(currentTime)}`);
            break;
        }

        onKeyDown?.(e);
      },
      [
        currentTime,
        min,
        max,
        step,
        applyPlayheadConstraints,
        stableOnMove,
        onTimeChange,
        announceChange,
        onKeyDown,
      ]
    );

    const handleMouseDown = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!draggable) return;

        e.preventDefault();
        const scrollContainer = scrollContainerRef.current;
        const container = containerRef.current;
        const playhead = playheadRef.current;

        if (!scrollContainer || !container || !playhead) return;

        draggingRef.current = true;
        stableOnMoveStart?.(e);
        announceChange("Started dragging playhead");

        let isDragging = true;
        const EDGE_THRESHOLD = 30;

        startAutoScroll(scrollContainer, (scrollDelta) => {
          const { canScrollLeft, canScrollRight } =
            getScrollState(scrollContainer);
          const isScrollingLeft = scrollDelta.x < 0;
          const isScrollingRight = scrollDelta.x > 0;
          const shouldAllowAutoScroll =
            (isScrollingLeft && canScrollLeft) ||
            (isScrollingRight && canScrollRight);

          if (Math.abs(scrollDelta.x) > 0 && shouldAllowAutoScroll) {
            const currentLeft = parseFloat(playhead.style.left || "0");
            const newLeft = Math.max(0, currentLeft + scrollDelta.x);
            const timeMs = pixelsToMs(newLeft);

            const constrainedTime = applyPlayheadConstraints(timeMs);
            const constrainedPos = msToPixels(constrainedTime);

            playhead.style.left = `${constrainedPos}px`;

            const syntheticEvent = {
              ...e,
              currentTarget: playhead,
              target: playhead,
            } as React.MouseEvent<HTMLDivElement>;

            stableOnMove?.(constrainedTime, syntheticEvent);
            onTimeChange?.(constrainedTime, syntheticEvent);
          }
        });

        const onMouseMove = (moveEvent: MouseEvent) => {
          if (!isDragging || !playhead) return;

          const scrollContainerRect = scrollContainer.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          const { containerWidth, canScrollLeft, canScrollRight } =
            getScrollState(scrollContainer);

          const mouseXRelativeToContainer =
            moveEvent.clientX - scrollContainerRect.left;
          const needsLeftScroll =
            mouseXRelativeToContainer <= EDGE_THRESHOLD && canScrollLeft;
          const needsRightScroll =
            mouseXRelativeToContainer >= containerWidth - EDGE_THRESHOLD &&
            canScrollRight;
          const shouldControlPlayhead = !needsLeftScroll && !needsRightScroll;

          if (needsLeftScroll || needsRightScroll) {
            handleAutoScroll(moveEvent);
          }

          if (shouldControlPlayhead) {
            const mouseX = moveEvent.clientX;
            let newX = mouseX - containerRect.left;
            newX = Math.max(0, newX);

            const timeMs = pixelsToMs(newX);

            const constrainedTime = applyPlayheadConstraints(timeMs);
            const constrainedPos = msToPixels(constrainedTime);

            playhead.style.left = `${constrainedPos}px`;

            const syntheticEvent = {
              ...e,
              currentTarget: playhead,
              target: playhead,
              clientX: moveEvent.clientX,
              clientY: moveEvent.clientY,
            } as React.MouseEvent<HTMLDivElement>;

            stableOnMove?.(constrainedTime, syntheticEvent);
            onTimeChange?.(constrainedTime, syntheticEvent);
          }
        };

        const onMouseUp = (upEvent: MouseEvent) => {
          isDragging = false;
          draggingRef.current = false;
          stopAutoScroll();

          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);

          const syntheticEvent = {
            ...e,
            currentTarget: playhead,
            target: playhead,
            clientX: upEvent.clientX,
            clientY: upEvent.clientY,
          } as React.MouseEvent<HTMLDivElement>;

          stableOnMoveEnd?.(syntheticEvent);
          announceChange(
            `Playhead positioned at ${formatDurationDisplay(pixelsToMs(parseFloat(playhead.style.left || "0")))}`
          );
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);

        onMouseDown?.(e);
      },
      [
        draggable,
        scrollContainerRef,
        containerRef,
        startAutoScroll,
        stopAutoScroll,
        handleAutoScroll,
        pixelsToMs,
        msToPixels,
        applyPlayheadConstraints,
        stableOnMove,
        stableOnMoveStart,
        stableOnMoveEnd,
        onTimeChange,
        announceChange,
        onMouseDown,
      ]
    );

    return (
      <div
        ref={composedRef}
        role="slider"
        aria-label="Timeline playhead"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={currentTime}
        aria-valuetext={`Playhead at ${formatDurationDisplay(currentTime)}`}
        aria-orientation="horizontal"
        aria-describedby={`${playheadId}-help`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        className={cn(
          "absolute top-0 left-0 bottom-0 w-px bg-primary z-20 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:bg-primary-active",
          draggable && "cursor-ew-resize",
          className
        )}
        {...props}
      >
        <div
          className="absolute -top-2 -left-2 h-4 w-4 bg-primary rotate-45"
          aria-hidden="true"
        />
        <div id={`${playheadId}-help`} className="sr-only">
          Use arrow keys to move playhead. Hold shift for fine control. Drag to
          reposition.
        </div>
      </div>
    );
  }
);

TimelinePlayhead.displayName = "Timeline.Playhead";

interface TimelineLeftHandleProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onDrag"> {
  onDragStart?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onDrag?: (
    position: number,
    e: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>
  ) => void;
  onDragEnd?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

const TimelineLeftHandle = forwardRef<HTMLDivElement, TimelineLeftHandleProps>(
  (
    {
      onDragStart,
      onDrag,
      onDragEnd,
      className,
      onMouseDown,
      onKeyDown,
      ...props
    },
    ref
  ) => {
    const {
      containerRef,
      scrollContainerRef,
      leftHandleRef,
      rightHandleRef,
      handleAutoScroll,
      startAutoScroll,
      stopAutoScroll,
      pixelsToMs,
      msToPixels,
      min,
      max,
      step,
      minGap,
      constraints,
      leftHandlePosition,
      rightHandlePosition,
      setLeftHandlePosition,
      announceChange,
      currentTime,
      tracks,
    } = useTimelineContext();

    const composedRef = useComposedRefs(ref, leftHandleRef);
    const [isDragging, setIsDragging] = useState(false);
    const handleId = useId();

    const stableOnDragStart = useStableHandler(onDragStart);
    const stableOnDrag = useStableHandler(onDrag);
    const stableOnDragEnd = useStableHandler(onDragEnd);

    const applyLeftHandleConstraints = useCallback(
      (proposedPosition: number): number => {
        let constrainedPosition = proposedPosition;

        const maxAllowed = rightHandlePosition - minGap;
        constrainedPosition = Math.max(
          min,
          Math.min(constrainedPosition, maxAllowed)
        );

        if (constraints?.leftHandle) {
          const constraintContext: ConstraintContext = {
            currentTime,
            leftHandlePosition: constrainedPosition,
            rightHandlePosition,
            min,
            max,
            tracks,
            currentTrackId: undefined,
          };

          constrainedPosition = constraints.leftHandle(
            constrainedPosition,
            constraintContext
          );

          constrainedPosition = Math.max(
            min,
            Math.min(constrainedPosition, maxAllowed)
          );
        }

        return constrainedPosition;
      },
      [constraints, min, rightHandlePosition, minGap, currentTime, max, tracks]
    );

    useEffect(() => {
      if (leftHandleRef.current && !isDragging) {
        leftHandleRef.current.style.left = `${msToPixels(leftHandlePosition)}px`;
      }
    }, [leftHandlePosition, msToPixels, isDragging]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        const fineStep = step / 10;
        const moveStep = e.shiftKey ? fineStep : step;

        switch (e.key) {
          case "ArrowLeft":
            e.preventDefault();
            const newPosLeft = leftHandlePosition - moveStep;
            const constrainedLeft = applyLeftHandleConstraints(newPosLeft);

            setLeftHandlePosition(constrainedLeft);
            stableOnDrag?.(constrainedLeft, e);
            announceChange(
              `Left handle moved to ${formatDurationDisplay(constrainedLeft)}`
            );
            break;
          case "ArrowRight":
            e.preventDefault();
            const newPosRight = leftHandlePosition + moveStep;
            const constrainedRight = applyLeftHandleConstraints(newPosRight);

            setLeftHandlePosition(constrainedRight);
            stableOnDrag?.(constrainedRight, e);
            announceChange(
              `Left handle moved to ${formatDurationDisplay(constrainedRight)}`
            );
            break;
          case "Home":
            e.preventDefault();
            const constrainedHome = applyLeftHandleConstraints(min);
            setLeftHandlePosition(constrainedHome);
            stableOnDrag?.(constrainedHome, e);
            announceChange(`Left handle moved to start`);
            break;
          case "Enter":
          case " ":
            e.preventDefault();
            announceChange(
              `Left handle at ${formatDurationDisplay(leftHandlePosition)}`
            );
            break;
        }

        onKeyDown?.(e);
      },
      [
        leftHandlePosition,
        step,
        applyLeftHandleConstraints,
        setLeftHandlePosition,
        stableOnDrag,
        announceChange,
        min,
        onKeyDown,
      ]
    );

    const handleMouseDown = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        const scrollContainer = scrollContainerRef.current;
        const container = containerRef.current;
        const leftHandle = leftHandleRef.current;
        const rightHandle = rightHandleRef.current;

        if (!scrollContainer || !container || !leftHandle || !rightHandle)
          return;

        setIsDragging(true);
        stableOnDragStart?.(e);
        announceChange("Started dragging left handle");

        let dragging = true;
        const EDGE_THRESHOLD = 30;

        startAutoScroll(scrollContainer, (scrollDelta) => {
          const { canScrollLeft, canScrollRight } =
            getScrollState(scrollContainer);
          const shouldAllowAutoScroll =
            (scrollDelta.x < 0 && canScrollLeft) ||
            (scrollDelta.x > 0 && canScrollRight);

          if (Math.abs(scrollDelta.x) > 0 && shouldAllowAutoScroll) {
            const currentPos = parseFloat(leftHandle.style.left || "0");
            const newPos = currentPos + scrollDelta.x;
            const newTime = pixelsToMs(newPos);

            const constrainedTime = applyLeftHandleConstraints(newTime);
            const constrainedPos = msToPixels(constrainedTime);

            leftHandle.style.left = `${constrainedPos}px`;
            setLeftHandlePosition(constrainedTime);

            const syntheticEvent = {
              ...e,
              currentTarget: leftHandle,
              target: leftHandle,
            } as React.MouseEvent<HTMLDivElement>;

            stableOnDrag?.(constrainedTime, syntheticEvent);
          }
        });

        const onMouseMove = (moveEvent: MouseEvent) => {
          if (!dragging) return;

          const scrollContainerRect = scrollContainer.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          const { containerWidth, canScrollLeft, canScrollRight } =
            getScrollState(scrollContainer);

          const mouseXRelativeToContainer =
            moveEvent.clientX - scrollContainerRect.left;
          const needsLeftScroll =
            mouseXRelativeToContainer <= EDGE_THRESHOLD && canScrollLeft;
          const needsRightScroll =
            mouseXRelativeToContainer >= containerWidth - EDGE_THRESHOLD &&
            canScrollRight;

          if (needsLeftScroll || needsRightScroll) {
            handleAutoScroll(moveEvent);
          } else {
            const mouseX = moveEvent.clientX - containerRect.left;
            const newTime = pixelsToMs(mouseX);

            const constrainedTime = applyLeftHandleConstraints(newTime);
            const constrainedPos = msToPixels(constrainedTime);

            leftHandle.style.left = `${constrainedPos}px`;
            setLeftHandlePosition(constrainedTime);

            const syntheticEvent = {
              ...e,
              currentTarget: leftHandle,
              target: leftHandle,
              clientX: moveEvent.clientX,
              clientY: moveEvent.clientY,
            } as React.MouseEvent<HTMLDivElement>;

            stableOnDrag?.(constrainedTime, syntheticEvent);
          }
        };

        const onMouseUp = (upEvent: MouseEvent) => {
          dragging = false;
          setIsDragging(false);
          stopAutoScroll();

          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);

          const syntheticEvent = {
            ...e,
            currentTarget: leftHandle,
            target: leftHandle,
            clientX: upEvent.clientX,
            clientY: upEvent.clientY,
          } as React.MouseEvent<HTMLDivElement>;

          stableOnDragEnd?.(syntheticEvent);
          announceChange(
            `Left handle positioned at ${formatDurationDisplay(leftHandlePosition)}`
          );
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);

        onMouseDown?.(e);
      },
      [
        scrollContainerRef,
        containerRef,
        leftHandleRef,
        rightHandleRef,
        handleAutoScroll,
        startAutoScroll,
        stopAutoScroll,
        pixelsToMs,
        msToPixels,
        applyLeftHandleConstraints,
        setLeftHandlePosition,
        leftHandlePosition,
        stableOnDragStart,
        stableOnDrag,
        stableOnDragEnd,
        announceChange,
        onMouseDown,
      ]
    );

    return (
      <div
        ref={composedRef}
        role="slider"
        aria-label="Timeline start trim handle"
        aria-valuemin={min}
        aria-valuemax={rightHandlePosition - minGap}
        aria-valuenow={leftHandlePosition}
        aria-valuetext={`Start trim at ${formatDurationDisplay(leftHandlePosition)}`}
        aria-orientation="horizontal"
        aria-describedby={`${handleId}-help`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        className={cn(
          "absolute w-3 h-full cursor-ew-resize z-20 top-0 left-0 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
          isDragging ? "scale-110" : "hover:scale-105",
          className
        )}
        {...props}
      >
        <div
          className="absolute inset-0 bg-primary rounded-md shadow-lg opacity-20 blur-sm"
          aria-hidden="true"
        />
        <div
          className={cn(
            "relative w-full h-full bg-gradient-to-b from-primary to-primary-active rounded-md shadow-md border border-primary/50 flex items-center justify-center transition-all duration-200",
            isDragging
              ? "shadow-lg shadow-primary/25"
              : "hover:shadow-md hover:shadow-primary/20"
          )}
        >
          <div
            className="absolute inset-0 bg-gradient-to-b from-primary/20 to-transparent rounded-md"
            aria-hidden="true"
          />
          <GripVertical
            size={10}
            className="text-foreground-on-accent drop-shadow-sm relative z-10"
            aria-hidden="true"
          />
        </div>
        <div id={`${handleId}-help`} className="sr-only">
          Left trim handle. Use arrow keys to move. Hold shift for fine control.
          Drag to reposition.
        </div>
      </div>
    );
  }
);

TimelineLeftHandle.displayName = "Timeline.LeftHandle";

// Timeline Right Handle
interface TimelineRightHandleProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onDrag"> {
  onDragStart?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onDrag?: (
    position: number,
    e: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>
  ) => void;
  onDragEnd?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

const TimelineRightHandle = forwardRef<
  HTMLDivElement,
  TimelineRightHandleProps
>(
  (
    {
      onDragStart,
      onDrag,
      onDragEnd,
      className,
      onMouseDown,
      onKeyDown,
      ...props
    },
    ref
  ) => {
    const {
      containerRef,
      scrollContainerRef,
      leftHandleRef,
      rightHandleRef,
      handleAutoScroll,
      startAutoScroll,
      stopAutoScroll,
      pixelsToMs,
      msToPixels,
      min,
      max,
      step,
      minGap,
      constraints,
      leftHandlePosition,
      rightHandlePosition,
      setRightHandlePosition,
      announceChange,
      currentTime,
      tracks,
    } = useTimelineContext();

    const composedRef = useComposedRefs(ref, rightHandleRef);
    const [isDragging, setIsDragging] = useState(false);
    const handleId = useId();

    const stableOnDragStart = useStableHandler(onDragStart);
    const stableOnDrag = useStableHandler(onDrag);
    const stableOnDragEnd = useStableHandler(onDragEnd);

    const applyRightHandleConstraints = useCallback(
      (proposedPosition: number): number => {
        let constrainedPosition = proposedPosition;

        const minAllowed = leftHandlePosition + minGap;
        constrainedPosition = Math.min(
          max,
          Math.max(constrainedPosition, minAllowed)
        );

        if (constraints?.rightHandle) {
          const constraintContext: ConstraintContext = {
            currentTime,
            leftHandlePosition,
            rightHandlePosition: constrainedPosition,
            min,
            max,
            tracks,
            currentTrackId: undefined,
          };

          constrainedPosition = constraints.rightHandle(
            constrainedPosition,
            constraintContext
          );

          constrainedPosition = Math.min(
            max,
            Math.max(constrainedPosition, minAllowed)
          );
        }

        return constrainedPosition;
      },
      [constraints, max, leftHandlePosition, minGap, currentTime, min, tracks]
    );

    useEffect(() => {
      if (rightHandleRef.current && !isDragging) {
        rightHandleRef.current.style.left = `${msToPixels(rightHandlePosition)}px`;
      }
    }, [rightHandlePosition, msToPixels, isDragging]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        const fineStep = step / 10;
        const moveStep = e.shiftKey ? fineStep : step;

        switch (e.key) {
          case "ArrowLeft":
            e.preventDefault();
            const newPosLeft = rightHandlePosition - moveStep;
            const constrainedLeft = applyRightHandleConstraints(newPosLeft);

            setRightHandlePosition(constrainedLeft);
            stableOnDrag?.(constrainedLeft, e);
            announceChange(
              `Right handle moved to ${formatDurationDisplay(constrainedLeft)}`
            );
            break;
          case "ArrowRight":
            e.preventDefault();
            const newPosRight = rightHandlePosition + moveStep;
            const constrainedRight = applyRightHandleConstraints(newPosRight);

            setRightHandlePosition(constrainedRight);
            stableOnDrag?.(constrainedRight, e);
            announceChange(
              `Right handle moved to ${formatDurationDisplay(constrainedRight)}`
            );
            break;
          case "End":
            e.preventDefault();
            const constrainedEnd = applyRightHandleConstraints(max);
            setRightHandlePosition(constrainedEnd);
            stableOnDrag?.(constrainedEnd, e);
            announceChange(`Right handle moved to end`);
            break;
          case "Enter":
          case " ":
            e.preventDefault();
            announceChange(
              `Right handle at ${formatDurationDisplay(rightHandlePosition)}`
            );
            break;
        }

        onKeyDown?.(e);
      },
      [
        rightHandlePosition,
        step,
        applyRightHandleConstraints,
        setRightHandlePosition,
        stableOnDrag,
        announceChange,
        max,
        onKeyDown,
      ]
    );

    const handleMouseDown = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        const scrollContainer = scrollContainerRef.current;
        const container = containerRef.current;
        const leftHandle = leftHandleRef.current;
        const rightHandle = rightHandleRef.current;

        if (!scrollContainer || !container || !leftHandle || !rightHandle)
          return;

        setIsDragging(true);
        stableOnDragStart?.(e);
        announceChange("Started dragging right handle");

        let dragging = true;
        const EDGE_THRESHOLD = 30;

        startAutoScroll(scrollContainer, (scrollDelta) => {
          const { canScrollLeft, canScrollRight } =
            getScrollState(scrollContainer);
          const shouldAllowAutoScroll =
            (scrollDelta.x < 0 && canScrollLeft) ||
            (scrollDelta.x > 0 && canScrollRight);

          if (Math.abs(scrollDelta.x) > 0 && shouldAllowAutoScroll) {
            const currentPos = parseFloat(
              rightHandle.style.left || `${msToPixels(max)}`
            );
            const newPos = currentPos + scrollDelta.x;
            const newTime = pixelsToMs(newPos);

            const constrainedTime = applyRightHandleConstraints(newTime);
            const constrainedPos = msToPixels(constrainedTime);

            rightHandle.style.left = `${constrainedPos}px`;
            setRightHandlePosition(constrainedTime);

            const syntheticEvent = {
              ...e,
              currentTarget: rightHandle,
              target: rightHandle,
            } as React.MouseEvent<HTMLDivElement>;

            stableOnDrag?.(constrainedTime, syntheticEvent);
          }
        });

        const onMouseMove = (moveEvent: MouseEvent) => {
          if (!dragging) return;

          const scrollContainerRect = scrollContainer.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          const { containerWidth, canScrollLeft, canScrollRight } =
            getScrollState(scrollContainer);

          const mouseXRelativeToContainer =
            moveEvent.clientX - scrollContainerRect.left;
          const needsLeftScroll =
            mouseXRelativeToContainer <= EDGE_THRESHOLD && canScrollLeft;
          const needsRightScroll =
            mouseXRelativeToContainer >= containerWidth - EDGE_THRESHOLD &&
            canScrollRight;

          if (needsLeftScroll || needsRightScroll) {
            handleAutoScroll(moveEvent);
          } else {
            const mouseX = moveEvent.clientX - containerRect.left;
            const newTime = pixelsToMs(mouseX);

            const constrainedTime = applyRightHandleConstraints(newTime);
            const constrainedPos = msToPixels(constrainedTime);

            rightHandle.style.left = `${constrainedPos}px`;
            setRightHandlePosition(constrainedTime);

            const syntheticEvent = {
              ...e,
              currentTarget: rightHandle,
              target: rightHandle,
              clientX: moveEvent.clientX,
              clientY: moveEvent.clientY,
            } as React.MouseEvent<HTMLDivElement>;

            stableOnDrag?.(constrainedTime, syntheticEvent);
          }
        };

        const onMouseUp = (upEvent: MouseEvent) => {
          dragging = false;
          setIsDragging(false);
          stopAutoScroll();

          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);

          const syntheticEvent = {
            ...e,
            currentTarget: rightHandle,
            target: rightHandle,
            clientX: upEvent.clientX,
            clientY: upEvent.clientY,
          } as React.MouseEvent<HTMLDivElement>;

          stableOnDragEnd?.(syntheticEvent);
          announceChange(
            `Right handle positioned at ${formatDurationDisplay(rightHandlePosition)}`
          );
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);

        onMouseDown?.(e);
      },
      [
        scrollContainerRef,
        containerRef,
        leftHandleRef,
        rightHandleRef,
        handleAutoScroll,
        startAutoScroll,
        stopAutoScroll,
        pixelsToMs,
        msToPixels,
        max,
        applyRightHandleConstraints,
        setRightHandlePosition,
        rightHandlePosition,
        stableOnDragStart,
        stableOnDrag,
        stableOnDragEnd,
        announceChange,
        onMouseDown,
      ]
    );

    return (
      <div
        ref={composedRef}
        role="slider"
        aria-label="Timeline end trim handle"
        aria-valuemin={leftHandlePosition + minGap}
        aria-valuemax={max}
        aria-valuenow={rightHandlePosition}
        aria-valuetext={`End trim at ${formatDurationDisplay(rightHandlePosition)}`}
        aria-orientation="horizontal"
        aria-describedby={`${handleId}-help`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        className={cn(
          "absolute w-3 h-full cursor-ew-resize z-20 top-0 right-0 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
          isDragging ? "scale-110" : "hover:scale-105",
          className
        )}
        {...props}
      >
        <div
          className="absolute inset-0 bg-primary rounded-md shadow-lg opacity-20 blur-sm"
          aria-hidden="true"
        />
        <div
          className={cn(
            "relative w-full h-full bg-gradient-to-b from-primary to-primary-active rounded-md shadow-md border border-primary/50 flex items-center justify-center transition-all duration-200",
            isDragging
              ? "shadow-lg shadow-primary/25"
              : "hover:shadow-md hover:shadow-primary/20"
          )}
        >
          <div
            className="absolute inset-0 bg-gradient-to-b from-primary/20 to-transparent rounded-md"
            aria-hidden="true"
          />
          <GripVertical
            size={10}
            className="text-foreground-on-accent drop-shadow-sm relative z-10"
            aria-hidden="true"
          />
        </div>
        <div id={`${handleId}-help`} className="sr-only">
          Right trim handle. Use arrow keys to move. Hold shift for fine
          control. Drag to reposition.
        </div>
      </div>
    );
  }
);

TimelineRightHandle.displayName = "Timeline.RightHandle";

interface TimelineReorderProps extends React.HTMLAttributes<HTMLDivElement> {
  strategy?: "closest" | "center" | "edge";
  onReorder?: (
    reorderedIds: string[],
    movedId: string,
    fromIndex: number,
    toIndex: number
  ) => void;
  disabled?: boolean;
}

// Timeline Reorder
const TimelineReorder = forwardRef<HTMLDivElement, TimelineReorderProps>(
  (
    {
      strategy = "closest",
      onReorder,
      disabled = false,
      children,
      className,
      ...props
    },
    ref
  ) => {
    const { tracks, announceChange } = useTimelineContext();

    const [orderedTrackIds, setOrderedTrackIds] = useState<string[]>(() =>
      Array.from(tracks.keys())
    );

    const { handleAutoScroll, startAutoScroll, stopAutoScroll } = useAutoScroll(
      {
        edgeThreshold: 30,
        maxScrollSpeed: 10,
        acceleration: 1.2,
        activationMargin: 50,
        enableVertical: true,
        verticalEdgeThreshold: 40,
        maxVerticalScrollSpeed: 15,
      }
    );

    const [dragState, setDragState] = useState<{
      draggedTrackId: string | null;
      dragOverTrackId: string | null;
      isDragging: boolean;
      overlayPosition: { x: number; y: number };
    }>({
      draggedTrackId: null,
      dragOverTrackId: null,
      isDragging: false,
      overlayPosition: { x: 0, y: 0 },
    });

    const reorderRef = useRef<HTMLDivElement>(null);
    const composedRef = useComposedRefs(ref, reorderRef);

    const trackPositions = useRef<
      Map<string, { y: number; height: number; x: number; width: number }>
    >(new Map());

    const draggedTrack = dragState.draggedTrackId
      ? tracks.get(dragState.draggedTrackId) || null
      : null;
    const dragOverTrack = dragState.dragOverTrackId
      ? tracks.get(dragState.dragOverTrackId) || null
      : null;

    const updateTrackPositions = useCallback(() => {
      if (!reorderRef.current) return;

      for (const [trackId, track] of tracks.entries()) {
        if (track.ref?.current) {
          const rect = track.ref.current.getBoundingClientRect();
          const containerRect = reorderRef.current.getBoundingClientRect();
          trackPositions.current.set(trackId, {
            y: rect.top - containerRect.top,
            height: rect.height,
            x: rect.left - containerRect.left,
            width: rect.width,
          });
        }
      }
    }, [tracks]);

    const findTrackAtPosition = useCallback(
      (y: number): string | null => {
        let closestTrack: string | null = null;
        let closestDistance = Infinity;

        for (const [trackId, position] of trackPositions.current.entries()) {
          const trackCenterY = position.y + position.height / 2;
          const distance = Math.abs(y - trackCenterY);

          if (strategy === "closest" && distance < closestDistance) {
            closestDistance = distance;
            closestTrack = trackId;
          } else if (
            strategy === "center" &&
            y >= position.y &&
            y <= position.y + position.height
          ) {
            closestTrack = trackId;
            break;
          } else if (strategy === "edge" && Math.abs(y - position.y) < 20) {
            closestTrack = trackId;
            break;
          }
        }

        return closestTrack;
      },
      [strategy]
    );

    const handleTrackDragStart = useCallback(
      (trackId: string, e: React.MouseEvent) => {
        if (disabled) return;

        updateTrackPositions();

        setDragState({
          draggedTrackId: trackId,
          dragOverTrackId: null,
          isDragging: true,
          overlayPosition: { x: e.clientX, y: e.clientY },
        });

        const track = tracks.get(trackId);
        announceChange(`Started dragging track ${track?.label || trackId}`);

        let isDragging = true;

        const onMouseMove = (moveEvent: MouseEvent) => {
          if (!isDragging || !reorderRef.current) return;

          const containerRect = reorderRef.current.getBoundingClientRect();
          const relativeY = moveEvent.clientY - containerRect.top;
          const targetTrackId = findTrackAtPosition(relativeY);

          setDragState((prev) => ({
            ...prev,
            overlayPosition: { x: moveEvent.clientX, y: moveEvent.clientY },
            dragOverTrackId: targetTrackId !== trackId ? targetTrackId : null,
          }));
        };

        const onMouseUp = () => {
          isDragging = false;
          const currentDragState = dragState;

          setDragState({
            draggedTrackId: null,
            dragOverTrackId: null,
            isDragging: false,
            overlayPosition: { x: 0, y: 0 },
          });

          if (
            currentDragState.dragOverTrackId &&
            currentDragState.dragOverTrackId !== trackId
          ) {
            setOrderedTrackIds((prev) => {
              const newOrder = [...prev];
              const fromIndex = newOrder.indexOf(trackId);
              const toIndex = newOrder.indexOf(
                currentDragState.dragOverTrackId!
              );

              newOrder.splice(fromIndex, 1);
              newOrder.splice(toIndex, 0, trackId);

              onReorder?.(newOrder, trackId, fromIndex, toIndex);

              announceChange(
                `Track ${track?.label || trackId} moved near ${
                  tracks.get(currentDragState.dragOverTrackId!)?.label ||
                  currentDragState.dragOverTrackId
                }`
              );

              return newOrder;
            });
          } else {
            announceChange(
              `Track ${track?.label || trackId} returned to original position`
            );
          }

          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      },
      [
        disabled,
        tracks,
        findTrackAtPosition,
        onReorder,
        announceChange,
        updateTrackPositions,
        dragState,
      ]
    );

    const contextValue: ReorderContextValue = useMemo(
      () => ({
        dragState,
        draggedTrack,
        dragOverTrack,
        handleTrackDragStart,
        orderedTrackIds,
      }),
      [
        dragState,
        draggedTrack,
        dragOverTrack,
        handleTrackDragStart,
        orderedTrackIds,
      ]
    );

    return (
      <ReorderContext.Provider value={contextValue}>
        <div ref={composedRef} className={cn("relative", className)} {...props}>
          {orderedTrackIds.map((id) => {
            const child = Array.isArray(children)
              ? (children as React.ReactElement[]).find(
                  (c) =>
                    React.isValidElement(c) &&
                    (c.props as Record<string, any>).id === id
                )
              : children;

            return React.isValidElement(child)
              ? React.cloneElement(child, {
                  ...contextValue,
                  key: id,
                })
              : child;
          })}
        </div>
      </ReorderContext.Provider>
    );
  }
);
TimelineReorder.displayName = "Timeline.Reorder";

// Timeline Reorder Overlay
interface TimelineReorderOverlayProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  children: (context: {
    draggedTrack: TrackContextValue | null;
    dragOverTrack: TrackContextValue | null;
    overlayPosition: { x: number; y: number };
    isDragging: boolean;
    orderedTrackIds: string[];
    timeline: TimelineContextValue;
  }) => React.ReactNode;
}

const TimelineReorderOverlay = forwardRef<
  HTMLDivElement,
  TimelineReorderOverlayProps
>(({ children, ...rest }, ref) => {
  const timeline = useTimelineContext();
  const reorder = useReorderContext();

  const overlayContent = children({
    draggedTrack: reorder.draggedTrack,
    dragOverTrack: reorder.dragOverTrack,
    overlayPosition: reorder.dragState.overlayPosition,
    isDragging: reorder.dragState.isDragging,
    orderedTrackIds: reorder.orderedTrackIds,
    timeline,
  });

  const overlayPosition = reorder.dragState.overlayPosition;

  if (typeof document === "undefined") {
    // SSR-safe: render nothing on server
    return null;
  }

  return createPortal(
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: overlayPosition.x,
        top: overlayPosition.y,
      }}
      {...rest}
    >
      {overlayContent}
    </div>,
    document.body
  );
});

TimelineReorderOverlay.displayName = "TimelineReorderOverlay";

// Timeline Resize Handle
interface TimelineResizeHandleProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  side: "left" | "right";
  onResizeStart?: (e: React.MouseEvent, side: "left" | "right") => void;
  icon?: React.ReactNode;
  disabled?: boolean;
}

const TimelineResizeHandle = forwardRef<
  HTMLButtonElement,
  TimelineResizeHandleProps
>(
  (
    {
      side,
      onResizeStart,
      icon,
      disabled = false,
      className,
      onMouseDown,
      children,
      ...props
    },
    ref
  ) => {
    const handleId = useId();

    const handleMouseDown = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (disabled) return;

        e.preventDefault();
        e.stopPropagation();

        onResizeStart?.(e, side);
        onMouseDown?.(e);
      },
      [disabled, onResizeStart, side, onMouseDown]
    );

    const defaultIcon = (
      <div className="w-1 h-4 bg-current rounded-full opacity-60 group-hover:opacity-100 transition-opacity" />
    );

    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        role="button"
        aria-label={`Resize layer ${side}`}
        aria-describedby={`${handleId}-help`}
        className={cn(
          "group absolute top-0 bottom-0 w-2 cursor-ew-resize bg-transparent hover:bg-primary/10 focus:bg-primary/20",
          "opacity-0 hover:opacity-100 focus:opacity-100 transition-all duration-200",
          "focus:outline-none focus:ring-1 focus:ring-primary focus:ring-inset",
          "flex items-center justify-center",
          "disabled:cursor-not-allowed disabled:opacity-50",
          side === "left" ? "left-0" : "right-0",
          className
        )}
        onMouseDown={handleMouseDown}
        {...props}
      >
        {children || icon || defaultIcon}
        <div id={`${handleId}-help`} className="sr-only">
          Drag to resize layer from the {side}
        </div>
      </button>
    );
  }
);
TimelineResizeHandle.displayName = "Timeline.ResizeHandle";

// Timeline Track
interface TimelineTrackBaseProps {
  id: string;
  label?: string;
  selected?: boolean;
  onSelect?: (id: string, e: React.MouseEvent | React.KeyboardEvent) => void;
  onConstrainLayer?: (
    layerId: string,
    proposedStart: number,
    proposedEnd: number,
    context: LayerConstraintContext
  ) => { start: number; end: number };
}

type TimelineTrackProps = AsChildProps<
  TimelineTrackBaseProps & React.HTMLAttributes<HTMLDivElement>
>;

const TimelineTrack = forwardRef<HTMLDivElement, TimelineTrackProps>(
  (
    {
      asChild = false,
      children,
      id,
      label,
      selected,
      onSelect,
      onConstrainLayer,
      className,
      onClick,
      onKeyDown,
      ...props
    },
    ref
  ) => {
    const { announceChange } = useTimelineContext();
    const trackRef = useRef<HTMLDivElement>(null);
    const composedRef = useComposedRefs(ref, trackRef);
    const trackId = useId();

    const stableOnSelect = useStableHandler(onSelect);

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        stableOnSelect?.(id, e);
        announceChange(`Track ${label || id} selected`);
        onClick?.(e);
      },
      [id, label, stableOnSelect, announceChange, onClick]
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        switch (e.key) {
          case "Enter":
          case " ":
            e.preventDefault();
            stableOnSelect?.(id, e);
            announceChange(`Track ${label || id} selected`);
            break;
        }

        onKeyDown?.(e);
      },
      [id, label, stableOnSelect, announceChange, onKeyDown]
    );

    const trackProps = {
      ref: composedRef,
      role: "button",
      "aria-labelledby": `${trackId}-label`,
      "aria-describedby": `${trackId}-desc`,
      "aria-selected": selected,
      tabIndex: 0,
      onClick: handleClick,
      onKeyDown: handleKeyDown,
      className: cn(
        "relative h-14 rounded-md border border-default overflow-hidden shadow-inner transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
        selected && "ring-2 ring-primary ring-offset-1 bg-primary/5",
        "hover:border-primary/50",
        className
      ),
      ...props,
    };

    const content = (
      <TrackProvider
        id={id}
        label={label}
        selected={selected}
        onSelect={onSelect}
        onConstrainLayer={onConstrainLayer}
      >
        <div className="absolute left-0 right-0 h-14">
          <div className="absolute inset-y-0 left-0 right-0 mx-2 rounded bg-surface-tertiary/60" />
          <div id={`${trackId}-label`} className="sr-only">
            {label || `Track ${id}`}
          </div>
          <div id={`${trackId}-desc`} className="sr-only">
            {selected
              ? "Selected track"
              : "Press Enter or Space to select track"}
          </div>
          {children}
        </div>
      </TrackProvider>
    );

    if (asChild && React.isValidElement(children)) {
      return (
        <TrackProvider
          id={id}
          label={label}
          selected={selected}
          onSelect={onSelect}
          onConstrainLayer={onConstrainLayer}
        >
          <Slot {...trackProps}>{children}</Slot>
        </TrackProvider>
      );
    }

    return <div {...trackProps}>{content}</div>;
  }
);
TimelineTrack.displayName = "Timeline.Track";

interface TimelineTrackLabelBaseProps
  extends React.HTMLAttributes<HTMLDivElement> {}

type TimelineTrackLabelProps = AsChildProps<
  TimelineTrackLabelBaseProps & React.HTMLAttributes<HTMLDivElement>
>;

const TimelineTrackLabel = forwardRef<HTMLDivElement, TimelineTrackLabelProps>(
  ({ asChild = false, children, className, ...props }, ref) => {
    const track = useTrackContext();
    const labelId = useId();

    const labelProps = {
      ref,
      id: labelId,
      className: cn(
        "text-sm font-medium text-foreground-default truncate",
        className
      ),
      "data-track-label": track.id,
      ...props,
    };

    if (asChild && React.isValidElement(children)) {
      return <Slot {...labelProps}>{children}</Slot>;
    }

    return <div {...labelProps}>{children || track.label || track.id}</div>;
  }
);
TimelineTrackLabel.displayName = "Timeline.Track.Label";

interface TimelineTrackLayerBaseProps {
  id?: string;
  start: number;
  end: number;
  onResizeStart?: (e: React.MouseEvent) => void;
  onResize?: (
    start: number,
    end: number,
    e: React.MouseEvent | React.KeyboardEvent
  ) => void;
  onResizeEnd?: (e: React.MouseEvent) => void;
  onDragStart?: (e: React.MouseEvent) => void;
  onDrag?: (
    start: number,
    end: number,
    e: React.MouseEvent | React.KeyboardEvent
  ) => void;
  onDragEnd?: (e: React.MouseEvent) => void;
  frames?: string[];
  resizable?: boolean;
  draggable?: boolean;
}

type TimelineTrackLayerProps = AsChildProps<
  TimelineTrackLayerBaseProps & React.HTMLAttributes<HTMLDivElement>
>;

const TimelineTrackLayer = forwardRef<HTMLDivElement, TimelineTrackLayerProps>(
  (
    {
      asChild = false,
      children,
      id: providedId,
      start: rawStart,
      end,
      onResizeStart,
      onResize,
      onResizeEnd,
      onDragStart,
      onDrag,
      onDragEnd,
      frames,
      resizable = true,
      draggable = true,
      className,
      onMouseEnter,
      onMouseMove,
      onMouseLeave,
      onMouseDown,
      onKeyDown,
      ...props
    },
    ref
  ) => {
    const {
      min,
      max,
      timelineBounds,
      msToPixels,
      pixelsToMs,
      pxPerMsRef,
      announceChange,
      containerRef,
      scrollContainerRef,
      handleAutoScroll,
      startAutoScroll,
      stopAutoScroll,
      recalculateBounds,
      tracks: timelineTracks,
      clampTime,
    } = useTimelineContext();
    const track = useTrackContext();
    const layerRef = useRef<HTMLDivElement>(null);
    const stripRef = useRef<HTMLDivElement>(null);
    const composedRef = useComposedRefs(ref, layerRef);

    const id = providedId ?? generateTimelineId("layer");
    const start = Math.max(0, rawStart);
    const layerId = useId();

    const [showTooltip, setShowTooltip] = useState(false);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [isResizing, setIsResizing] = useState<"left" | "right" | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const draggingRef = useRef(false);
    const rafIdRef = useRef<number | null>(null);

    const stableOnDragStart = useStableHandler(onDragStart);
    const stableOnDrag = useStableHandler(onDrag);
    const stableOnDragEnd = useStableHandler(onDragEnd);

    const width = msToPixels(end - start);
    const left = msToPixels(start);
    const layerDuration = end - start;

    useEffect(() => {
      if (stripRef.current && frames) {
        renderTimelineStrips({
          pxPerMs: pxPerMsRef.current,
          durationMs: end - start,
          frames,
          container: stripRef.current,
        });
      }
    }, [start, end, frames, pxPerMsRef]);

    const applyLayerConstraints = useCallback(
      (
        newStart: number,
        newEnd: number,
        e: React.MouseEvent | React.KeyboardEvent
      ): { start: number; end: number } => {
        let constrainedStart = Math.max(0, newStart);
        let constrainedEnd = newEnd;

        constrainedStart = Math.max(min, constrainedStart);

        if (timelineBounds !== Infinity) {
          constrainedEnd = Math.min(timelineBounds, constrainedEnd);
        } else {
          if (constrainedEnd > max) {
            recalculateBounds();
          }
        }

        if (track.onConstrainLayer) {
          const constraintContext: LayerConstraintContext = {
            allLayers: Array.from(track.layers.values()),
            currentLayer: {
              id,
              start,
              end,
              onResizeStart,
              onResize,
              onResizeEnd,
              tooltipState: { showTooltip, mousePosition },
            },
            tracks: timelineTracks,
            timeline: useTimelineContext(),
          };

          const constrained = track.onConstrainLayer(
            id,
            constrainedStart,
            constrainedEnd,
            constraintContext
          );

          constrainedStart = Math.max(0, constrained.start);
          constrainedEnd = constrained.end;
        }

        return { start: constrainedStart, end: constrainedEnd };
      },
      [
        id,
        start,
        end,
        track.onConstrainLayer,
        min,
        max,
        timelineBounds,
        recalculateBounds,
        showTooltip,
        mousePosition,
        timelineTracks,
      ]
    );

    const handleLayerDrag = useCallback(
      (
        newStart: number,
        newEnd: number,
        e: React.MouseEvent | React.KeyboardEvent
      ) => {
        const { start: constrainedStart, end: constrainedEnd } =
          applyLayerConstraints(newStart, newEnd, e);
        stableOnDrag?.(constrainedStart, constrainedEnd, e);
      },
      [applyLayerConstraints, stableOnDrag]
    );

    const handleLayerResize = useCallback(
      (
        newStart: number,
        newEnd: number,
        e: React.MouseEvent | React.KeyboardEvent
      ) => {
        const { start: constrainedStart, end: constrainedEnd } =
          applyLayerConstraints(newStart, newEnd, e);
        onResize?.(constrainedStart, constrainedEnd, e);
        announceChange(
          `Layer resized to ${formatDurationDisplay(constrainedStart)} - ${formatDurationDisplay(constrainedEnd)}`
        );
      },
      [applyLayerConstraints, onResize, announceChange]
    );

    const handleMouseDown = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!draggable || isResizing) return;

        e.preventDefault();
        const scrollContainer = scrollContainerRef.current;
        const container = containerRef.current;
        const layer = layerRef.current;

        if (!scrollContainer || !container || !layer) return;

        setIsDragging(true);
        draggingRef.current = true;
        stableOnDragStart?.(e);
        announceChange("Started dragging layer");

        let isDragActive = true;
        const startMouseX = e.clientX;
        const startLayerStart = start;
        const EDGE_THRESHOLD = 30;

        startAutoScroll(scrollContainer, (scrollDelta) => {
          const { canScrollLeft, canScrollRight } =
            getScrollState(scrollContainer);
          const isScrollingLeft = scrollDelta.x < 0;
          const isScrollingRight = scrollDelta.x > 0;
          const shouldAllowAutoScroll =
            (isScrollingLeft && canScrollLeft) ||
            (isScrollingRight && canScrollRight);

          if (Math.abs(scrollDelta.x) > 0 && shouldAllowAutoScroll) {
            const currentLeft = parseFloat(
              layer.style.left || `${msToPixels(start)}`
            );
            const newLeft = currentLeft + scrollDelta.x;
            const newStartTime = pixelsToMs(newLeft);
            const newEndTime = newStartTime + layerDuration;

            const { start: constrainedStart, end: constrainedEnd } =
              applyLayerConstraints(newStartTime, newEndTime, e);

            layer.style.left = `${msToPixels(constrainedStart)}px`;

            const syntheticEvent = {
              ...e,
              currentTarget: layer,
              target: layer,
            } as React.MouseEvent<HTMLDivElement>;

            handleLayerDrag(constrainedStart, constrainedEnd, syntheticEvent);

            if (tooltipContentRef.current) {
              tooltipContentRef.current.textContent = `${formatDurationDisplay(constrainedStart)} - ${formatDurationDisplay(constrainedEnd)}`;
            }
          }
        });

        flushSync(() => {
          setShowTooltip(true);
        });

        if (tooltipContentRef.current) {
          tooltipContentRef.current.textContent = `${formatDurationDisplay(start)} - ${formatDurationDisplay(end)}`;
        }

        const onMouseMove = (moveEvent: MouseEvent) => {
          if (!isDragActive || !layer) return;

          if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);

          rafIdRef.current = requestAnimationFrame(() => {
            const scrollContainerRect = scrollContainer.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            if (!scrollContainerRect || !containerRect) return;

            const { containerWidth, canScrollLeft, canScrollRight } =
              getScrollState(scrollContainer);

            const mouseXRelativeToContainer =
              moveEvent.clientX - scrollContainerRect.left;
            const needsLeftScroll =
              mouseXRelativeToContainer <= EDGE_THRESHOLD && canScrollLeft;
            const needsRightScroll =
              mouseXRelativeToContainer >= containerWidth - EDGE_THRESHOLD &&
              canScrollRight;
            const shouldControlLayer = !needsLeftScroll && !needsRightScroll;

            if (needsLeftScroll || needsRightScroll) {
              handleAutoScroll(moveEvent);
            }

            if (shouldControlLayer) {
              const mouseX = moveEvent.clientX - containerRect.left;
              const startMouseXRel = startMouseX - containerRect.left;
              const deltaX = mouseX - startMouseXRel;
              const deltaTime = pixelsToMs(deltaX);

              const newStartTime = Math.max(0, startLayerStart + deltaTime);
              const newEndTime = newStartTime + layerDuration;

              const { start: constrainedStart, end: constrainedEnd } =
                applyLayerConstraints(newStartTime, newEndTime, e);

              layer.style.left = `${msToPixels(constrainedStart)}px`;

              if (tooltipContentRef.current) {
                tooltipContentRef.current.textContent = `${formatDurationDisplay(constrainedStart)} - ${formatDurationDisplay(constrainedEnd)}`;
              }

              const syntheticEvent = {
                ...e,
                currentTarget: layer,
                target: layer,
                clientX: moveEvent.clientX,
                clientY: moveEvent.clientY,
              } as React.MouseEvent<HTMLDivElement>;

              handleLayerDrag(constrainedStart, constrainedEnd, syntheticEvent);
            }
          });
        };

        const onMouseUp = (upEvent: MouseEvent) => {
          isDragActive = false;
          setIsDragging(false);
          draggingRef.current = false;
          stopAutoScroll();
          setShowTooltip(false);

          if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
          }

          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);

          const syntheticEvent = {
            ...e,
            currentTarget: layer,
            target: layer,
            clientX: upEvent.clientX,
            clientY: upEvent.clientY,
          } as React.MouseEvent<HTMLDivElement>;

          stableOnDragEnd?.(syntheticEvent);
          announceChange(
            `Layer positioned at ${formatDurationDisplay(pixelsToMs(parseFloat(layer.style.left || "0")))}`
          );
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);

        onMouseDown?.(e);
      },
      [
        draggable,
        isResizing,
        scrollContainerRef,
        containerRef,
        start,
        end,
        layerDuration,
        max,
        msToPixels,
        pixelsToMs,
        startAutoScroll,
        stopAutoScroll,
        handleAutoScroll,
        applyLayerConstraints,
        stableOnDragStart,
        stableOnDrag,
        stableOnDragEnd,
        announceChange,
        onMouseDown,
      ]
    );

    const handleMouseEnter = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!draggingRef.current && !isResizing) {
          setShowTooltip(true);
          setMousePosition({
            x: e.clientX,
            y: e.clientY - 40,
          });
        }
        onMouseEnter?.(e);
      },
      [isResizing, onMouseEnter]
    );

    const handleMouseMove = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (showTooltip && !draggingRef.current && !isResizing) {
          setMousePosition({
            x: e.clientX,
            y: e.clientY - 40,
          });
        }
        onMouseMove?.(e);
      },
      [showTooltip, isResizing, onMouseMove]
    );

    const handleMouseLeave = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!draggingRef.current && !isResizing) {
          setShowTooltip(false);
        }
        onMouseLeave?.(e);
      },
      [isResizing, onMouseLeave]
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        const stepSize = 100;
        const fineStep = 10;
        const moveStep = e.shiftKey ? fineStep : stepSize;

        switch (e.key) {
          case "ArrowLeft":
            if (!e.ctrlKey && !e.metaKey && draggable) {
              e.preventDefault();
              const newStart = Math.max(0, start - moveStep);
              const newEnd = newStart + layerDuration;

              const { start: constrainedStart, end: constrainedEnd } =
                applyLayerConstraints(newStart, newEnd, e);

              handleLayerDrag(constrainedStart, constrainedEnd, e);
              announceChange(
                `Layer moved to ${formatDurationDisplay(constrainedStart)}`
              );
            } else if ((e.ctrlKey || e.metaKey) && resizable) {
              e.preventDefault();
              const newStart = Math.max(0, start - moveStep);
              handleLayerResize(newStart, end, e);
            }
            break;
          case "ArrowRight":
            if (!e.ctrlKey && !e.metaKey && draggable) {
              e.preventDefault();
              const newStart = start + moveStep;
              const newEnd = newStart + layerDuration;

              const { start: constrainedStart, end: constrainedEnd } =
                applyLayerConstraints(newStart, newEnd, e);

              handleLayerDrag(constrainedStart, constrainedEnd, e);
              announceChange(
                `Layer moved to ${formatDurationDisplay(constrainedStart)}`
              );
            } else if ((e.ctrlKey || e.metaKey) && resizable) {
              e.preventDefault();
              const newEnd = end + moveStep;
              handleLayerResize(start, newEnd, e);
            }
            break;
          case "Enter":
          case " ":
            e.preventDefault();
            announceChange(
              `Layer from ${formatDurationDisplay(start)} to ${formatDurationDisplay(end)}`
            );
            break;
        }

        onKeyDown?.(e);
      },
      [
        start,
        end,
        layerDuration,
        draggable,
        resizable,
        applyLayerConstraints,
        handleLayerDrag,
        handleLayerResize,
        announceChange,
        onKeyDown,
      ]
    );

    const handleResizeStart = useCallback(
      (e: React.MouseEvent, side: "left" | "right") => {
        setIsResizing(side);
        onResizeStart?.(e);
        announceChange(`Started resizing layer ${side} edge`);

        const startMouseX = e.clientX;
        const startStart = start;
        const startEnd = end;

        const handleMouseMove = (moveEvent: MouseEvent) => {
          const deltaX = moveEvent.clientX - startMouseX;
          const deltaTime = pixelsToMs(deltaX);

          let newStart = startStart;
          let newEnd = startEnd;

          if (side === "left") {
            newStart = Math.max(0, startStart + deltaTime);
            newStart = Math.min(newStart, startEnd - 100);
          } else {
            newEnd = Math.max(startStart + 100, startEnd + deltaTime);
          }

          handleLayerResize(newStart, newEnd, e);
        };

        const handleMouseUp = () => {
          setIsResizing(null);
          document.removeEventListener("mousemove", handleMouseMove);
          document.removeEventListener("mouseup", handleMouseUp);

          onResizeEnd?.(e);
          announceChange(`Finished resizing layer`);
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
      },
      [
        start,
        end,
        pixelsToMs,
        handleLayerResize,
        onResizeStart,
        onResizeEnd,
        announceChange,
      ]
    );

    const tooltipContentRef = useRef<HTMLSpanElement>(null);

    const layerProps = {
      ref: composedRef,
      "data-track-id": track.id,
      "data-layer-id": id,
      role: "button",
      "aria-label": `${draggable ? "Draggable " : ""}${resizable ? "Resizable " : ""}Layer from ${formatDurationDisplay(start)} to ${formatDurationDisplay(end)}`,
      "aria-describedby": `${layerId}-help`,
      tabIndex: 0,
      onKeyDown: handleKeyDown,
      onMouseEnter: handleMouseEnter,
      onMouseMove: handleMouseMove,
      onMouseLeave: handleMouseLeave,
      onMouseDown: handleMouseDown,
      className: cn(
        "absolute top-0 h-14 rounded-md border border-default overflow-hidden shadow-inner transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
        "hover:border-primary/50 hover:shadow-md",
        isResizing && "ring-2 ring-primary",
        isDragging && "ring-2 ring-primary cursor-grabbing",
        draggable && !isDragging && "cursor-grab",
        className
      ),
      style: {
        width: `${width}px`,
        left: `${left}px`,
      },
      ...props,
    };

    const content = (
      <LayerProvider
        id={id}
        start={start}
        end={end}
        onResizeStart={onResizeStart}
        onResize={onResize}
        onResizeEnd={onResizeEnd}
        tooltipState={{ showTooltip, mousePosition }}
      >
        <div id={`${layerId}-help`} className="sr-only">
          {draggable ? "Drag to move layer. Arrow keys to move. " : ""}
          {resizable ? "Use Ctrl+arrow keys to resize edges. " : ""}
          Hold shift for fine control.
        </div>
        <div ref={stripRef} className="absolute inset-0 flex items-stretch" />

        {resizable && (
          <>
            <TimelineResizeHandle
              side="left"
              onResizeStart={handleResizeStart}
            />
            <TimelineResizeHandle
              side="right"
              onResizeStart={handleResizeStart}
            />
          </>
        )}
        {children}
      </LayerProvider>
    );

    if (asChild && React.isValidElement(children)) {
      return (
        <LayerProvider
          id={id}
          start={start}
          end={end}
          onResizeStart={onResizeStart}
          onResize={onResize}
          onResizeEnd={onResizeEnd}
          tooltipState={{ showTooltip, mousePosition }}
        >
          <Slot {...layerProps}>{children}</Slot>
        </LayerProvider>
      );
    }

    return <div {...layerProps}>{content}</div>;
  }
);
TimelineTrackLayer.displayName = "Timeline.Track.Layer";

// Timeline Track Layer Tooltip
interface TimelineTrackLayerTooltipProps {
  children: ({ start, end }: { start: number; end: number }) => React.ReactNode;
  portal?: boolean;
  container?: HTMLElement;
}

const TimelineTrackLayerTooltip = ({
  children,
  portal = true,
  container,
}: TimelineTrackLayerTooltipProps) => {
  const { start, end, tooltipState } = useLayerContext();

  if (!tooltipState?.showTooltip) return null;

  const targetContainer =
    container ?? (typeof document !== "undefined" ? document.body : null);

  if (!targetContainer) return null;

  const tooltipContent = (
    <div
      role="tooltip"
      className="fixed z-50 pointer-events-none"
      style={{
        left: tooltipState.mousePosition.x,
        top: tooltipState.mousePosition.y,
        transform: "translate(-50%, -100%)",
      }}
    >
      <div className="bg-surface-secondary text-foreground-default px-3 py-1.5 rounded-xl shadow-lg text-xs font-medium whitespace-nowrap">
        {children({ start, end })}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-surface-secondary" />
      </div>
    </div>
  );

  if (portal) {
    return createPortal(tooltipContent, targetContainer);
  }

  return tooltipContent;
};

TimelineTrackLayerTooltip.displayName = "Timeline.Track.LayerTooltip";

export const Timeline = {
  Root: TimelineRoot,
  Content: TimelineContent,
  Ruler: TimelineRuler,
  Playhead: TimelinePlayhead,
  LeftHandle: TimelineLeftHandle,
  RightHandle: TimelineRightHandle,
  ResizeHandle: TimelineResizeHandle,
  Reorder: Object.assign(TimelineReorder, {
    Overlay: TimelineReorderOverlay,
  }),
  Track: Object.assign(TimelineTrack, {
    Layer: Object.assign(TimelineTrackLayer, {
      Tooltip: TimelineTrackLayerTooltip,
    }),
    Label: TimelineTrackLabel,
  }),
};

TimelineTrackLayerTooltip;

export type {
  TimelineRootProps,
  TimelineContentProps,
  TimelineRulerProps,
  TimelinePlayheadProps,
  TimelineLeftHandleProps,
  TimelineRightHandleProps,
  TimelineReorderProps,
  TimelineReorderOverlayProps,
  TimelineTrackProps,
  TimelineTrackLayerProps,
  TimelineTrackLayerTooltipProps,
  TimelineResizeHandleProps,
  TimelineTrackLabelProps,
};
