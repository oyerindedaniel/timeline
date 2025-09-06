# @repo/timeline

A flexible and customizable timeline component library built with React and TypeScript.

## Features

- 🎨 **Compound Components**: Flexible API with Timeline.Root, Timeline.Item, etc.
- 📱 **Responsive**: Works on all screen sizes with horizontal and vertical orientations
- 🎯 **TypeScript**: Full type safety and IntelliSense support
- 🎛️ **Customizable**: Multiple variants and styling options
- 🔧 **Accessible**: Built with accessibility in mind
- 📦 **Tree-shakeable**: Only import what you need

## Installation

```bash
# In your monorepo workspace
pnpm add @repo/timeline
```

## Quick Start

```tsx
import { Timeline } from "@repo/timeline";

function MyTimeline() {
  return (
    <Timeline.Root>
      <Timeline.Item>
        <Timeline.Content>
          <Timeline.Header>Project Started</Timeline.Header>
          <Timeline.Description>
            Initial planning and setup phase
          </Timeline.Description>
          <Timeline.Date>2024-01-01</Timeline.Date>
        </Timeline.Content>
      </Timeline.Item>

      <Timeline.Item>
        <Timeline.Content>
          <Timeline.Header>Development Phase</Timeline.Header>
          <Timeline.Description>Core feature development</Timeline.Description>
          <Timeline.Date>2024-02-01</Timeline.Date>
        </Timeline.Content>
      </Timeline.Item>
    </Timeline.Root>
  );
}
```

## Components

### Timeline.Root

The main container component that provides context to all child components.

```tsx
<Timeline.Root
  orientation="vertical" // or "horizontal"
  variant="default" // or "compact" | "detailed"
  showConnectors={true}
>
  {/* Timeline items */}
</Timeline.Root>
```

### Timeline.Item

Individual timeline item container.

```tsx
<Timeline.Item>
  <Timeline.Content>{/* Content components */}</Timeline.Content>
</Timeline.Item>
```

### Timeline.Content

Content wrapper with positioning options.

```tsx
<Timeline.Content side="alternate">
  {" "}
  {/* or "left" | "right" */}
  {/* Header, Description, Date components */}
</Timeline.Content>
```

### Timeline.Header

Timeline item title/header.

```tsx
<Timeline.Header>Event Title</Timeline.Header>
```

### Timeline.Description

Timeline item description.

```tsx
<Timeline.Description>Event description text</Timeline.Description>
```

### Timeline.Date

Timeline item date with formatting options.

```tsx
<Timeline.Date format="short">2024-01-01</Timeline.Date>
```

### Timeline.Connector

Connector line between timeline items.

```tsx
<Timeline.Connector variant="solid" /> {/* or "dashed" | "dotted" */}
```

## Hooks

### useTimelineContext

Access timeline context within timeline components.

```tsx
import { useTimelineContext } from "@repo/timeline";

function MyComponent() {
  const { orientation, variant, items } = useTimelineContext();
  // Use timeline state
}
```

### useControllableState

Create controllable state for timeline items.

```tsx
import { useControllableState } from "@repo/timeline";

function MyComponent() {
  const [value, setValue] = useControllableState({
    value: controlledValue,
    defaultValue: "default",
    onChange: handleChange,
  });
}
```

## Styling

The timeline components use CSS classes that you can style with your preferred CSS framework:

- `.timeline` - Root container
- `.timeline-item` - Individual timeline item
- `.timeline-content` - Content wrapper
- `.timeline-header` - Item header
- `.timeline-description` - Item description
- `.timeline-date` - Item date
- `.timeline-connector` - Connector line

## TypeScript

All components are fully typed. Import types as needed:

```tsx
import type {
  TimelineItem,
  TimelineProps,
  TimelineContextValue,
} from "@repo/timeline";
```

## License

MIT

