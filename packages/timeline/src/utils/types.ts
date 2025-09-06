import { ReactNode } from "react";

export interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  date: Date | string;
  status?: "completed" | "in-progress" | "pending" | "cancelled";
  data?: Record<string, any>;
}

export interface TimelineProps {
  children: ReactNode;
  className?: string;
  orientation?: "vertical" | "horizontal";
  variant?: "default" | "compact" | "detailed";
  showConnectors?: boolean;
  items?: TimelineItem[];
}

export interface TimelineItemProps {
  children: ReactNode;
  className?: string;
  item?: TimelineItem;
  index?: number;
  isLast?: boolean;
  isFirst?: boolean;
}

export interface TimelineContentProps {
  children: ReactNode;
  className?: string;
  side?: "left" | "right" | "alternate";
}

export interface TimelineHeaderProps {
  children: ReactNode;
  className?: string;
}

export interface TimelineDescriptionProps {
  children: ReactNode;
  className?: string;
}

export interface TimelineDateProps {
  children: ReactNode;
  className?: string;
  format?: "short" | "long" | "relative";
}

export interface TimelineConnectorProps {
  className?: string;
  variant?: "solid" | "dashed" | "dotted";
}

export interface TimelineContextValue {
  orientation: "vertical" | "horizontal";
  variant: "default" | "compact" | "detailed";
  showConnectors: boolean;
  items: TimelineItem[];
  registerItem: (item: TimelineItem) => void;
  unregisterItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<TimelineItem>) => void;
}

export type TimelineComponent = {
  Root: React.ComponentType<TimelineProps>;
  Item: React.ComponentType<TimelineItemProps>;
  Content: React.ComponentType<TimelineContentProps>;
  Header: React.ComponentType<TimelineHeaderProps>;
  Description: React.ComponentType<TimelineDescriptionProps>;
  Date: React.ComponentType<TimelineDateProps>;
  Connector: React.ComponentType<TimelineConnectorProps>;
};
