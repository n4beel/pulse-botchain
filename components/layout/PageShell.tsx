"use client";

import Link from "next/link";
import ConnectButton from "@/components/ui/ConnectButton";
import NetworkBadge from "@/components/botchain/NetworkBadge";
import { app } from "@/lib/app-config";

export interface PageShellProps {
  children: React.ReactNode;
}

/**
 * Bento Archetype K Page Frame.
 *
 * Full-bleed magenta ground with a floating pill (top wordmark + heartbeat glyph,
 * network badge and wallet connect control) that sits over the grid and scrolls away.
 * No navigation bar, no header bar, no bottom band — footer is a tile inside the grid.
 */
export default function PageShell({ children }: PageShellProps) {
  return (
    <div className="min-h-[100dvh] bg-[var(--bg-base)] text-[var(--text-on-ground)] selection:bg-[var(--accent)] selection:text-[var(--accent-ink)]">
      {/* Floating pill over the grid */}
      <header className="sticky top-4 z-40 max-w-[1100px] mx-auto px-3 sm:px-4 mb-4 sm:mb-6 pointer-events-none">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-2.5 sm:py-3 rounded-full bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] shadow-2xl pointer-events-auto backdrop-blur-md">
          {/* Brand mark with heartbeat glyph */}
          <Link
            href="/"
            className="flex items-center gap-2.5 text-lg sm:text-xl font-extrabold tracking-tight text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-lg"
          >
            {/* Heartbeat pulse icon */}
            <svg
              className="w-5 h-5 text-[var(--accent)] pulse-heart flex-shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              <path d="M3.22 12H9.5l1.5-3 2 6 1.5-3h6.28" />
            </svg>
            <span>{app.name}</span>
          </Link>

          {/* Right controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:block">
              <NetworkBadge />
            </div>
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* Main 12-column Bento container */}
      <main className="max-w-[1100px] mx-auto px-3 sm:px-4 pb-16">{children}</main>
    </div>
  );
}
