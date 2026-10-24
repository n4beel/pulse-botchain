import { HTMLAttributes, ReactNode } from "react";

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  variant?: "dark" | "inverted" | "subtle";
  className?: string;
}

/**
 * Bento grid tile (Archetype K).
 * Rounded 28px corners, dark surface or inverted lime ground, no hover lift.
 */
export default function Panel({
  children,
  variant = "dark",
  className = "",
  style,
  ...props
}: PanelProps) {
  let variantStyles = "bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)]";
  if (variant === "inverted") {
    variantStyles = "bg-[var(--accent)] text-[var(--accent-ink)] border border-[var(--accent)]";
  } else if (variant === "subtle") {
    variantStyles = "bg-[var(--bg-surface)]/80 text-[var(--text-primary)] border border-[var(--border-subtle)]/60";
  }

  return (
    <div
      className={`rounded-[28px] p-6 md:p-8 relative overflow-hidden transition-colors ${variantStyles} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}
