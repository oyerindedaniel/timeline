import React, {
  forwardRef,
  useRef,
  useCallback,
  useEffect,
  useState,
  useId,
} from "react";
import { createPortal, flushSync } from "react-dom";
import { Button } from "./components/button";
import { cn } from "./utils/cn";
import {
  TimelineRootProvider,
  TrackProvider,
  LayerProvider,
  useLayerContext,
  useTimelineContext,
  useTrackContext,
} from "./context";
import { useComposedRefs, useStableHandler } from "./hooks";
import { formatDurationDisplay } from "./utils/display";
import {
  renderTimelineRuler,
  renderTimelineStrips,
  getScrollState,
} from "./utils/timeline-utils";
import { Slot } from "./utils/primitives";
import type { ConstraintContext, LayerConstraintContext } from "./context";
import { msToPixels, pixelsToMs } from "./utils/math";
import { GripVertical } from "./icons";

type AsChildProps<DefaultElementProps> =
  | ({ asChild?: false } & DefaultElementProps)
  | ({ asChild: true; children: React.ReactElement } & Omit<
      DefaultElementProps,
      "children"
    >);

interface TimelineRootProps extends React.HTMLAttributes<HTMLDivElement> {
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

const TimelineRoot = forwardRef<HTMLDivElement, TimelineRootProps>(
  (
    {
      children,
      currentTime,
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
        min={min}
        max={max}
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
            "flex relative flex-col gap-2 w-full focus-within:outline-none",
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
    } = useTimelineContext();

    const composedRef = useComposedRefs(ref, playheadRef);
    const draggingRef = useRef(false);
    const playheadId = React.useId();

    const stableOnMove = useStableHandler(onMove);
    const stableOnMoveStart = useStableHandler(onMoveStart);
    const stableOnMoveEnd = useStableHandler(onMoveEnd);

    useEffect(() => {
      if (playheadRef.current && !draggingRef.current) {
        const position = msToPixels(currentTime);
        playheadRef.current.style.left = `${position}px`;
      }
    }, [currentTime, msToPixels, playheadRef]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        const fineStep = step / 10;
        const moveStep = e.shiftKey ? fineStep : step;

        switch (e.key) {
          case "ArrowLeft": {
            e.preventDefault();
            const newTimeLeft = Math.max(min, currentTime - moveStep);
            stableOnMove?.(newTimeLeft, e);
            onTimeChange?.(newTimeLeft, e);
            announceChange(
              `Playhead moved to ${formatDurationDisplay(newTimeLeft)}`
            );
            break;
          }
          case "ArrowRight": {
            e.preventDefault();
            const newTimeRight = Math.min(max, currentTime + moveStep);
            stableOnMove?.(newTimeRight, e);
            onTimeChange?.(newTimeRight, e);
            announceChange(
              `Playhead moved to ${formatDurationDisplay(newTimeRight)}`
            );
            break;
          }
          case "Home": {
            e.preventDefault();
            stableOnMove?.(min, e);
            onTimeChange?.(min, e);
            announceChange(`Playhead moved to start`);
            break;
          }
          case "End": {
            e.preventDefault();
            stableOnMove?.(max, e);
            onTimeChange?.(max, e);
            announceChange(`Playhead moved to end`);
            break;
          }
          case "Enter":
          case " ": {
            e.preventDefault();
            announceChange(`Playhead at ${formatDurationDisplay(currentTime)}`);
            break;
          }
        }

        onKeyDown?.(e);
      },
      [
        currentTime,
        min,
        max,
        step,
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
          const isScrollingLeft = scrollDelta < 0;
          const isScrollingRight = scrollDelta > 0;
          const shouldAllowAutoScroll =
            (isScrollingLeft && canScrollLeft) ||
            (isScrollingRight && canScrollRight);

          if (Math.abs(scrollDelta) > 0 && shouldAllowAutoScroll) {
            const currentLeft = parseFloat(playhead.style.left || "0");
            const newLeft = Math.max(0, currentLeft + scrollDelta);

            playhead.style.left = `${newLeft}px`;
            let timeMs = pixelsToMs(newLeft);

            if (constraints?.playhead) {
              const constraintContext = {
                currentTime,
                leftHandlePosition: 0,
                rightHandlePosition: max,
                min,
                max,
                tracks: new Map(),
                currentTrackId: undefined,
              };
              timeMs = constraints.playhead(timeMs, constraintContext);
            }

            const syntheticEvent = {
              ...e,
              currentTarget: playhead,
              target: playhead,
            } as React.MouseEvent<HTMLDivElement>;

            stableOnMove?.(timeMs, syntheticEvent);
            onTimeChange?.(timeMs, syntheticEvent);
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

            playhead.style.left = `${newX}px`;
            let timeMs = pixelsToMs(newX);

            if (constraints?.playhead) {
              const constraintContext = {
                currentTime,
                leftHandlePosition: 0,
                rightHandlePosition: max,
                min,
                max,
                tracks: new Map(),
                currentTrackId: undefined,
              };
              timeMs = constraints.playhead(timeMs, constraintContext);
            }

            const syntheticEvent = {
              ...e,
              currentTarget: playhead,
              target: playhead,
              clientX: moveEvent.clientX,
              clientY: moveEvent.clientY,
            } as React.MouseEvent<HTMLDivElement>;

            stableOnMove?.(timeMs, syntheticEvent);
            onTimeChange?.(timeMs, syntheticEvent);
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
            `Playhead positioned at ${formatDurationDisplay(
              pixelsToMs(parseFloat(playhead.style.left || "0"))
            )}`
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
        constraints,
        currentTime,
        min,
        max,
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
  onDrag?: (position: number, e: React.MouseEvent<HTMLDivElement>) => void;
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
      min,
      max,
      step,
      minGap,
      msToPixels,
      pixelsToMs,
      constraints,
      leftHandlePosition,
      rightHandlePosition,
      setLeftHandlePosition,
      announceChange,
    } = useTimelineContext();

    const composedRef = useComposedRefs(ref, leftHandleRef);
    const [isDragging, setIsDragging] = useState(false);
    const handleId = useId();

    const stableOnDragStart = useStableHandler(onDragStart);
    const stableOnDrag = useStableHandler(onDrag);
    const stableOnDragEnd = useStableHandler(onDragEnd);

    useEffect(() => {
      if (leftHandleRef.current) {
        leftHandleRef.current.style.left = `${msToPixels(
          leftHandlePosition
        )}px`;
      }
    }, [leftHandlePosition, msToPixels]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        const fineStep = step / 10;
        const moveStep = e.shiftKey ? fineStep : step;

        switch (e.key) {
          case "ArrowLeft": {
            e.preventDefault();
            const newPosLeft = Math.max(min, leftHandlePosition - moveStep);
            const maxAllowedLeft = rightHandlePosition - minGap;
            const constrainedLeft = Math.min(newPosLeft, maxAllowedLeft);

            //TODO: review e argument type
            setLeftHandlePosition(constrainedLeft);
            stableOnDrag?.(constrainedLeft, e as any);
            announceChange(
              `Left handle moved to ${formatDurationDisplay(constrainedLeft)}`
            );
            break;
          }
          case "ArrowRight": {
            e.preventDefault();
            const newPosRight = leftHandlePosition + moveStep;
            const maxAllowedRight = rightHandlePosition - minGap;
            const constrainedRight = Math.min(newPosRight, maxAllowedRight);

            setLeftHandlePosition(constrainedRight);
            stableOnDrag?.(constrainedRight, e as any);
            announceChange(
              `Left handle moved to ${formatDurationDisplay(constrainedRight)}`
            );
            break;
          }
          case "Home": {
            e.preventDefault();
            setLeftHandlePosition(min);
            stableOnDrag?.(min, e as any);
            announceChange("Left handle moved to start");
            break;
          }
          case "Enter":
          case " ": {
            e.preventDefault();
            announceChange(
              `Left handle at ${formatDurationDisplay(leftHandlePosition)}`
            );
            break;
          }
        }

        onKeyDown?.(e);
      },
      [
        leftHandlePosition,
        rightHandlePosition,
        min,
        minGap,
        step,
        setLeftHandlePosition,
        stableOnDrag,
        announceChange,
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
            (scrollDelta < 0 && canScrollLeft) ||
            (scrollDelta > 0 && canScrollRight);

          if (Math.abs(scrollDelta) > 0 && shouldAllowAutoScroll) {
            const currentPos = parseFloat(leftHandle.style.left || "0");
            let newPos = Math.max(0, currentPos + scrollDelta);

            const rightPos = parseFloat(
              rightHandle.style.left || `${msToPixels(max)}`
            );
            const maxAllowedPos = Math.max(0, rightPos - msToPixels(minGap));
            newPos = Math.min(newPos, maxAllowedPos);

            let constrainedTime = pixelsToMs(newPos);
            if (constraints?.leftHandle) {
              const constraintContext = {
                currentTime: 0,
                leftHandlePosition: constrainedTime,
                rightHandlePosition: pixelsToMs(rightPos),
                min,
                max,
                tracks: new Map(),
                currentTrackId: undefined,
              };
              constrainedTime = constraints.leftHandle(
                constrainedTime,
                constraintContext
              );
              newPos = msToPixels(constrainedTime);
            }

            leftHandle.style.left = `${newPos}px`;
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
            let newPos = Math.max(0, mouseX);

            const rightPos = parseFloat(
              rightHandle.style.left || `${msToPixels(max)}`
            );
            const maxAllowedPos = Math.max(0, rightPos - msToPixels(minGap));
            newPos = Math.min(newPos, maxAllowedPos);

            // Custom constraints
            let constrainedTime = pixelsToMs(newPos);
            if (constraints?.leftHandle) {
              const constraintContext = {
                currentTime: 0,
                leftHandlePosition: constrainedTime,
                rightHandlePosition: pixelsToMs(rightPos),
                min,
                max,
                tracks: new Map(),
                currentTrackId: undefined,
              };
              constrainedTime = constraints.leftHandle(
                constrainedTime,
                constraintContext
              );
              newPos = msToPixels(constrainedTime);
            }

            leftHandle.style.left = `${newPos}px`;
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
            `Left handle positioned at ${formatDurationDisplay(
              leftHandlePosition
            )}`
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
        minGap,
        constraints,
        min,
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
        aria-valuetext={`Start trim at ${formatDurationDisplay(
          leftHandlePosition
        )}`}
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
  onDrag?: (position: number, e: React.MouseEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

const TimelineRightHandle = React.forwardRef<
  HTMLDivElement,
  TimelineRightHandleProps
>(function TimelineRightHandle(
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
) {
  const {
    containerRef,
    scrollContainerRef,
    leftHandleRef,
    rightHandleRef,
    handleAutoScroll,
    startAutoScroll,
    stopAutoScroll,
    min,
    max,
    step,
    msToPixels,
    pixelsToMs,
    minGap,
    constraints,
    leftHandlePosition,
    rightHandlePosition,
    setRightHandlePosition,
    announceChange,
  } = useTimelineContext();

  const composedRef = useComposedRefs(ref, rightHandleRef);
  const [isDragging, setIsDragging] = React.useState(false);
  const handleId = React.useId();

  const stableOnDragStart = useStableHandler(onDragStart);
  const stableOnDrag = useStableHandler(onDrag);
  const stableOnDragEnd = useStableHandler(onDragEnd);

  React.useEffect(
    function updateHandlePosition() {
      if (rightHandleRef.current) {
        rightHandleRef.current.style.left = `${msToPixels(
          rightHandlePosition
        )}px`;
      }
    },
    [rightHandlePosition, msToPixels]
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const fineStep = step / 10;
      const moveStep = e.shiftKey ? fineStep : step;

      switch (e.key) {
        case "ArrowLeft": {
          e.preventDefault();
          const newPos = Math.max(
            rightHandlePosition - moveStep,
            leftHandlePosition + minGap
          );
          setRightHandlePosition(newPos);
          stableOnDrag?.(
            newPos,
            e as unknown as React.MouseEvent<HTMLDivElement>
          );
          announceChange(
            `Right handle moved to ${formatDurationDisplay(newPos)}`
          );
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          const newPos = Math.min(max, rightHandlePosition + moveStep);
          setRightHandlePosition(newPos);
          stableOnDrag?.(
            newPos,
            e as unknown as React.MouseEvent<HTMLDivElement>
          );
          announceChange(
            `Right handle moved to ${formatDurationDisplay(newPos)}`
          );
          break;
        }
        case "End": {
          e.preventDefault();
          setRightHandlePosition(max);
          stableOnDrag?.(max, e as unknown as React.MouseEvent<HTMLDivElement>);
          announceChange(`Right handle moved to end`);
          break;
        }
        case "Enter":
        case " ": {
          e.preventDefault();
          announceChange(
            `Right handle at ${formatDurationDisplay(rightHandlePosition)}`
          );
          break;
        }
      }

      onKeyDown?.(e);
    },
    [
      step,
      minGap,
      leftHandlePosition,
      rightHandlePosition,
      max,
      setRightHandlePosition,
      stableOnDrag,
      announceChange,
      onKeyDown,
    ]
  );

  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();

      const scrollContainer = scrollContainerRef.current;
      const container = containerRef.current;
      const leftHandle = leftHandleRef.current;
      const rightHandle = rightHandleRef.current;

      if (!scrollContainer || !container || !leftHandle || !rightHandle) return;

      setIsDragging(true);
      stableOnDragStart?.(e);
      announceChange("Started dragging right handle");

      let dragging = true;

      startAutoScroll(scrollContainer, (scrollDelta) => {
        const { canScrollLeft, canScrollRight } =
          getScrollState(scrollContainer);
        if (
          Math.abs(scrollDelta) > 0 &&
          ((scrollDelta < 0 && canScrollLeft) ||
            (scrollDelta > 0 && canScrollRight))
        ) {
          const currentPos = parseFloat(
            rightHandle.style.left || `${msToPixels(max)}`
          );
          let newPos = currentPos + scrollDelta;

          const leftPos = parseFloat(leftHandle.style.left || "0");
          const minAllowed = leftPos + msToPixels(minGap);
          newPos = Math.max(minAllowed, Math.min(newPos, msToPixels(max)));

          let constrainedTime = pixelsToMs(newPos);
          if (constraints?.rightHandle) {
            constrainedTime = constraints.rightHandle(constrainedTime, {
              currentTime: 0,
              leftHandlePosition: pixelsToMs(leftPos),
              rightHandlePosition: constrainedTime,
              min,
              max,
              tracks: new Map(),
              currentTrackId: undefined,
            });
            newPos = msToPixels(constrainedTime);
          }

          rightHandle.style.left = `${newPos}px`;
          setRightHandlePosition(constrainedTime);

          stableOnDrag?.(constrainedTime, {
            ...e,
            currentTarget: rightHandle,
            target: rightHandle,
          } as React.MouseEvent<HTMLDivElement>);
        }
      });

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!dragging) return;
        const containerRect = container.getBoundingClientRect();
        let newPos = moveEvent.clientX - containerRect.left;

        const leftPos = parseFloat(leftHandle.style.left || "0");
        const minAllowed = leftPos + msToPixels(minGap);
        newPos = Math.max(minAllowed, Math.min(newPos, msToPixels(max)));

        let constrainedTime = pixelsToMs(newPos);
        if (constraints?.rightHandle) {
          constrainedTime = constraints.rightHandle(constrainedTime, {
            currentTime: 0,
            leftHandlePosition: pixelsToMs(leftPos),
            rightHandlePosition: constrainedTime,
            min,
            max,
            tracks: new Map(),
            currentTrackId: undefined,
          });
          newPos = msToPixels(constrainedTime);
        }

        rightHandle.style.left = `${newPos}px`;
        setRightHandlePosition(constrainedTime);

        stableOnDrag?.(constrainedTime, {
          ...e,
          currentTarget: rightHandle,
          target: rightHandle,
          clientX: moveEvent.clientX,
          clientY: moveEvent.clientY,
        } as React.MouseEvent<HTMLDivElement>);
      };

      const onMouseUp = (upEvent: MouseEvent) => {
        dragging = false;
        setIsDragging(false);
        stopAutoScroll();

        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);

        stableOnDragEnd?.({
          ...e,
          currentTarget: rightHandle,
          target: rightHandle,
          clientX: upEvent.clientX,
          clientY: upEvent.clientY,
        } as React.MouseEvent<HTMLDivElement>);
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
      startAutoScroll,
      stopAutoScroll,
      msToPixels,
      pixelsToMs,
      minGap,
      max,
      constraints,
      min,
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
        Right trim handle. Use arrow keys to move. Hold shift for fine control.
        Drag to reposition.
      </div>
    </div>
  );
});

TimelineRightHandle.displayName = "Timeline.RightHandle";

// Timeline Track
interface TimelineTrackBaseProps {
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
            stableOnSelect?.(id, e as any);
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

interface TimelineTrackLayerBaseProps {
  id: string;
  start: number;
  end: number;
  onResizeStart?: (e: React.MouseEvent) => void;
  onResize?: (start: number, end: number, e: React.MouseEvent) => void;
  onResizeEnd?: (e: React.MouseEvent) => void;
  onDragStart?: (e: React.MouseEvent) => void;
  onDrag?: (start: number, end: number, e: React.MouseEvent) => void;
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
      id,
      start,
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
      msToPixels,
      pixelsToMs,
      pxPerMsRef,
      announceChange,
      containerRef,
      scrollContainerRef,
      handleAutoScroll,
      startAutoScroll,
      stopAutoScroll,
      min,
      max,
    } = useTimelineContext();
    const track = useTrackContext();
    const layerRef = useRef<HTMLDivElement>(null);
    const stripRef = useRef<HTMLDivElement>(null);
    const composedRef = useComposedRefs(ref, layerRef);
    const layerId = useId();

    const [showTooltip, setShowTooltip] = useState(false);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [isResizing, setIsResizing] = useState<"left" | "right" | null>(null);
    const draggingLayerRef = useRef(false);
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

    const applyConstraints = useCallback(
      (
        proposedStart: number,
        proposedEnd: number,
        e: React.MouseEvent
      ): { start: number; end: number } => {
        let constrainedStart = Math.max(min, proposedStart);
        let constrainedEnd = Math.min(max, proposedEnd);

        if (track.onConstrainLayer) {
          const constraintContext = {
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
            tracks: new Map(),
            timeline: useTimelineContext(),
          };

          const constrained = track.onConstrainLayer(
            id,
            constrainedStart,
            constrainedEnd,
            constraintContext
          );

          constrainedStart = constrained.start;
          constrainedEnd = constrained.end;
        }

        return { start: constrainedStart, end: constrainedEnd };
      },
      [
        id,
        start,
        end,
        track.onConstrainLayer,
        showTooltip,
        mousePosition,
        min,
        max,
      ]
    );

    const handleLayerMouseDown = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!draggable || isResizing) return;

        e.preventDefault();
        const scrollContainer = scrollContainerRef.current;
        const container = containerRef.current;
        const layer = layerRef.current;

        if (!scrollContainer || !container || !layer) return;

        const containerRect = container.getBoundingClientRect();

        draggingLayerRef.current = true;
        stableOnDragStart?.(e);
        announceChange("Started dragging layer");

        let isDragging = true;
        const startLayerStart = start;
        const startMouseX = e.clientX - containerRect.left;
        const EDGE_THRESHOLD = 30;

        // TODO: review
        const maxOffsetMs = max - layerDuration;

        startAutoScroll(scrollContainer, (scrollDelta) => {
          const { canScrollLeft, canScrollRight } = getScrollState(
            scrollContainer,
            undefined,
            msToPixels(maxOffsetMs)
          );

          const isScrollingLeft = scrollDelta < 0;
          const isScrollingRight = scrollDelta > 0;

          const shouldAllowAutoScroll =
            (isScrollingLeft && canScrollLeft) ||
            (isScrollingRight && canScrollRight);

          if (Math.abs(scrollDelta) > 0 && shouldAllowAutoScroll) {
            const currentLeft = parseFloat(
              layer.style.left || `${msToPixels(start)}`
            );
            const newLeft = Math.max(
              0,
              Math.min(currentLeft + scrollDelta, msToPixels(maxOffsetMs))
            );

            const newStartTime = pixelsToMs(newLeft);
            const newEndTime = newStartTime + layerDuration;

            const { start: constrainedStart, end: constrainedEnd } =
              applyConstraints(newStartTime, newEndTime, e);

            layer.style.left = `${msToPixels(constrainedStart)}px`;

            stableOnDrag?.(constrainedStart, constrainedEnd, e);
          }
        });

        flushSync(() => {
          setShowTooltip(true);
        });

        const onMove = (moveEvent: MouseEvent) => {
          if (!isDragging) return;

          if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);

          rafIdRef.current = requestAnimationFrame(() => {
            const scrollContainerRect = scrollContainer.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            if (!scrollContainerRect || !containerRect) return;

            const maxContentWidth = msToPixels(max);
            const { containerWidth, canScrollLeft, canScrollRight } =
              getScrollState(scrollContainer, maxContentWidth);

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
              const deltaX = mouseX - startMouseX;
              const deltaMs = pixelsToMs(deltaX);

              const newStartTime = Math.max(
                0,
                Math.min(startLayerStart + deltaMs, maxOffsetMs)
              );
              const newEndTime = newStartTime + layerDuration;

              const { start: constrainedStart, end: constrainedEnd } =
                applyConstraints(newStartTime, newEndTime, e);

              layer.style.left = `${msToPixels(constrainedStart)}px`;

              if (tooltipContentRef.current) {
                const text = `Position: ${formatDurationDisplay(constrainedStart)} - ${formatDurationDisplay(constrainedEnd)}`;
                tooltipContentRef.current.textContent = text;
              }

              stableOnDrag?.(constrainedStart, constrainedEnd, e as any);
            }
          });
        };

        const onUp = () => {
          isDragging = false;
          draggingLayerRef.current = false;
          stopAutoScroll();
          setShowTooltip(false);

          if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
          }

          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);

          stableOnDragEnd?.(e);
          announceChange(
            `Layer positioned at ${formatDurationDisplay(pixelsToMs(parseFloat(layer.style.left || "0")))}`
          );
        };

        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);

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
        applyConstraints,
        stableOnDragStart,
        stableOnDrag,
        stableOnDragEnd,
        announceChange,
        onMouseDown,
      ]
    );

    const handleMouseEnter = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!draggingLayerRef.current && !isResizing) {
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
        if (showTooltip && !draggingLayerRef.current && !isResizing) {
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
        if (!draggingLayerRef.current && !isResizing) {
          setShowTooltip(false);
        }
        onMouseLeave?.(e);
      },
      [isResizing, onMouseLeave]
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        const step = 100; // 100ms steps
        const fineStep = 10; // Fine control
        const moveStep = e.shiftKey ? fineStep : step;

        switch (e.key) {
          case "ArrowLeft":
            if (!e.ctrlKey && !e.metaKey && draggable) {
              // Move layer left
              e.preventDefault();
              const newStart = Math.max(0, start - moveStep);
              const newEnd = newStart + layerDuration;

              const { start: constrainedStart, end: constrainedEnd } =
                applyConstraints(newStart, newEnd, e as any);

              stableOnDrag?.(constrainedStart, constrainedEnd, e as any);
              announceChange(
                `Layer moved to ${formatDurationDisplay(constrainedStart)}`
              );
            } else if ((e.ctrlKey || e.metaKey) && resizable) {
              // Resize left edge
              e.preventDefault();
              const newStart = Math.max(0, start - moveStep);
              onResize?.(newStart, end, e as any);
              announceChange(
                `Layer start resized to ${formatDurationDisplay(newStart)}`
              );
            }
            break;
          case "ArrowRight":
            if (!e.ctrlKey && !e.metaKey && draggable) {
              // Move layer right
              e.preventDefault();
              const newStart = start + moveStep;
              const newEnd = newStart + layerDuration;

              const { start: constrainedStart, end: constrainedEnd } =
                applyConstraints(newStart, newEnd, e as any);

              stableOnDrag?.(constrainedStart, constrainedEnd, e as any);
              announceChange(
                `Layer moved to ${formatDurationDisplay(constrainedStart)}`
              );
            } else if ((e.ctrlKey || e.metaKey) && resizable) {
              // Resize right edge
              e.preventDefault();
              const newEnd = end + moveStep;
              onResize?.(start, newEnd, e as any);
              announceChange(
                `Layer end resized to ${formatDurationDisplay(newEnd)}`
              );
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
        applyConstraints,
        stableOnDrag,
        onResize,
        announceChange,
        onKeyDown,
      ]
    );

    // Resize handles logic (existing implementation)
    const handleResizeStart = useCallback(
      (e: React.MouseEvent, side: "left" | "right") => {
        e.preventDefault();
        e.stopPropagation();

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
            newStart = Math.min(newStart, startEnd - 100); // 100ms minimum
          } else {
            newEnd = Math.max(startStart + 100, startEnd + deltaTime);
          }

          const { start: constrainedStart, end: constrainedEnd } =
            applyConstraints(newStart, newEnd, e);

          onResize?.(constrainedStart, constrainedEnd, e);
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
        applyConstraints,
        onResizeStart,
        onResize,
        onResizeEnd,
        announceChange,
      ]
    );

    const renderResizeHandles = () => {
      if (!resizable) return null;

      return (
        <>
          <div
            role="button"
            aria-label="Resize layer start"
            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-primary/50 opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity focus:outline-none focus:ring-1 focus:ring-primary"
            onMouseDown={(e) => handleResizeStart(e, "left")}
            tabIndex={0}
          />
          <div
            role="button"
            aria-label="Resize layer end"
            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-primary/50 opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity focus:outline-none focus:ring-1 focus:ring-primary"
            onMouseDown={(e) => handleResizeStart(e, "right")}
            tabIndex={0}
          />
        </>
      );
    };

    const tooltipContentRef = useRef<HTMLSpanElement>(null);

    const layerProps = {
      ref: composedRef,
      role: "button",
      "aria-label": `${draggable ? "Draggable " : ""}${resizable ? "Resizable " : ""}Layer from ${formatDurationDisplay(start)} to ${formatDurationDisplay(end)}`,
      "aria-describedby": `${layerId}-help`,
      tabIndex: 0,
      onKeyDown: handleKeyDown,
      onMouseEnter: handleMouseEnter,
      onMouseMove: handleMouseMove,
      onMouseLeave: handleMouseLeave,
      onMouseDown: handleLayerMouseDown,
      className: cn(
        "absolute top-0 h-14 rounded-md border border-default overflow-hidden shadow-inner transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
        "hover:border-primary/50 hover:shadow-md",
        isResizing && "ring-2 ring-primary",
        draggingLayerRef.current && "ring-2 ring-primary cursor-grabbing",
        draggable && !draggingLayerRef.current && "cursor-grab",
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
        {renderResizeHandles()}
        {children}

        {showTooltip && (
          <div className="absolute z-50 pointer-events-none translate-x-2/4">
            <div
              className="bg-surface-secondary text-foreground-default px-3 py-1.5 rounded-xl shadow-lg text-xs font-medium whitespace-nowrap"
              style={{
                left: mousePosition.x,
                top: mousePosition.y,
                transform: "translate(-50%, -100%)",
                position: "fixed",
              }}
            >
              <span className="text-primary" ref={tooltipContentRef}>
                {formatDurationDisplay(start)} - {formatDurationDisplay(end)}
              </span>
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-surface-secondary" />
            </div>
          </div>
        )}
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
  container = document.body,
}: TimelineTrackLayerTooltipProps) => {
  const { start, end, tooltipState } = useLayerContext();

  if (!tooltipState?.showTooltip) return null;

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
    return createPortal(tooltipContent, container);
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
  Track: Object.assign(TimelineTrack, {
    Layer: TimelineTrackLayer,
    LayerTooltip: TimelineTrackLayerTooltip,
  }),
};

export type {
  TimelineRootProps,
  TimelineContentProps,
  TimelineRulerProps,
  TimelinePlayheadProps,
  TimelineLeftHandleProps,
  TimelineRightHandleProps,
  TimelineTrackProps,
  TimelineTrackLayerProps,
  TimelineTrackLayerTooltipProps,
};
