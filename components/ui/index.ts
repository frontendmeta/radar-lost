// Lost Sale Radar design system. Living style guide: /design-system
// Server-safe unless marked (client): Input, Toggle, Stepper, Segmented.

export { cn } from "./cn";
export * from "./format";
export * from "./meta";

// Data display (Radar)
export { StatBlock, type StatBlockProps, type StatTone } from "./stat-block";
export { BarRow, type BarRowProps } from "./bar-row";
export { ReasonRow, type ReasonRowProps } from "./reason-row";
export { LensChip, type LensChipProps } from "./lens-chip";
export { AssistantBadge, type AssistantBadgeProps } from "./assistant-badge";
export { AssistantLogo, type AssistantLogoProps } from "./assistant-logo";
export { OutcomeDot, type OutcomeDotProps } from "./outcome-dot";
export { OutcomePill, type OutcomePillProps } from "./outcome-pill";
export { DeltaBadge, type DeltaBadgeProps } from "./delta-badge";
export { YouTag, type YouTagProps } from "./you-tag";
export { Chip, type ChipProps, type ChipTone } from "./chip";

// Actions
export { Button, type ButtonProps, type LinkButtonProps, type ButtonVariant, type ButtonSize } from "./button";

// Shell
export { TopBar, type TopBarProps, type WorkerStatus } from "./top-bar";
export { Dock, DEFAULT_DOCK_ITEMS, type DockProps, type DockItem } from "./dock";
export { HeroBand, type HeroBandProps } from "./hero-band";
export { RadarMark, type RadarMarkProps } from "./radar-mark";
export { Card, type CardProps } from "./card";
export { BrandTheme, brandRampVars, isColourless, type BrandThemeProps } from "./brand-theme";

// Conversation / trace
export { QueryBubble, type QueryBubbleProps } from "./query-bubble";
export { SearchPill, type SearchPillProps } from "./search-pill";
export { SourceRow, type SourceRowProps } from "./source-row";

// Lists and rows
export { FixCard, type FixCardProps } from "./fix-card";
export { RunRow, StatusRing, type RunRowProps, type StatusRingProps } from "./run-row";
export { ProgressBar, type ProgressBarProps } from "./progress-bar";

// Feedback
export { Banner, type BannerProps, type BannerTone } from "./banner";
export { Toast, type ToastProps, type ToastTone } from "./toast";
export { Tooltip, TooltipBubble, type TooltipProps, type TooltipBubbleProps } from "./tooltip";
export { EmptyState, type EmptyStateProps } from "./empty-state";
export { Skeleton, SkeletonCard, type SkeletonProps } from "./skeleton";

// Form controls
export { Input, type InputProps } from "./input";
export { Toggle, type ToggleProps } from "./toggle";
export { Stepper, type StepperProps } from "./stepper";
export { Segmented, type SegmentedProps, type SegmentedOption } from "./segmented";
export { VerticalTab, type VerticalTabProps } from "./vertical-tab";
