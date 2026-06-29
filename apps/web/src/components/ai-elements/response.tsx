/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file renders streamed Operator markdown with syntax highlighting, tables, task lists, and hardened links.
*/
import { memo, type ComponentProps } from "react";
import { Streamdown } from "streamdown";

import { cx } from "@/lib/cx";

import "streamdown/styles.css";

export type ResponseProps = ComponentProps<typeof Streamdown>;

// Wraps Streamdown so every Operator answer renders as rich markdown: bold, italic, headings,
// ordered and unordered lists, task lists, blockquotes, tables, horizontal rules, inline code,
// and fenced code blocks with highlighting, copy controls, and horizontal scrolling. Incomplete
// markdown is completed while a response streams so partial tokens never break the layout. The
// memo compares children so a steady stream only re-renders when the text actually grows.
export const Response = memo(
  ({ className, ...props }: ResponseProps) => (
    <Streamdown
      className={cx(
        "size-full text-sm leading-relaxed text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className,
      )}
      {...props}
    />
  ),
  (prev, next) => prev.children === next.children,
);

Response.displayName = "Response";
