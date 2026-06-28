"use client";
import type { CSSProperties, ReactNode } from "react";

// Fires an in-page run in the Overview control room (same page, no navigation).
export function RunTrigger({
  cmd,
  className,
  style,
  children,
}: {
  cmd: "review" | "onboard" | "merge";
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={() => window.dispatchEvent(new CustomEvent("autoqa-run", { detail: cmd }))}
    >
      {children}
    </button>
  );
}
