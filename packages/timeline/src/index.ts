// Main Timeline component and compound components
export { Timeline } from "./timeline";

// Context and provider
export { TimelineRootProvider, useTimelineContext } from "./context";

// Hooks
export { useVideoThumbnails } from "./timeline-hooks/use-video-thumbnails";

export type {
  TimelineItem,
  TimelineProps,
  TimelineItemProps,
  TimelineContentProps,
  TimelineHeaderProps,
  TimelineDescriptionProps,
  TimelineDateProps,
  TimelineConnectorProps,
  TimelineContextValue,
  TimelineComponent,
} from "./utils/types";
