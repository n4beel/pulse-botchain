"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

export type ButtonVariant = "hero" | "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

/**
 * Bento Archetype K Button.
 * Hero action is 64px tall, bold, rounded-2xl, touch-target friendly, no hover lift.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    disabled = false,
    className = "",
    children,
    ...props
  },
  ref,
) {
  let variantClass = "";
  if (variant === "hero") {
    variantClass =
      "h-16 w-full text-lg md:text-xl font-extrabold rounded-2xl bg-[var(--accent-ink)] text-[var(--accent)] hover:bg-[var(--accent-ink)]/90 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed";
  } else if (variant === "primary") {
    variantClass =
      "font-bold rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] hover:bg-[var(--accent)]/90 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed";
  } else if (variant === "secondary") {
    variantClass =
      "font-semibold rounded-xl bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-[var(--text-muted)] disabled:opacity-50 disabled:cursor-not-allowed";
  } else if (variant === "ghost") {
    variantClass =
      "font-medium rounded-xl text-[var(--text-primary)] hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed";
  }

  let sizeClass = "";
  if (variant !== "hero") {
    if (size === "sm") sizeClass = "h-9 px-3 text-xs";
    else if (size === "md") sizeClass = "h-11 px-5 text-sm";
    else if (size === "lg") sizeClass = "h-14 px-8 text-base";
  }

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] select-none ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>{children}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
});

export default Button;
