import type { Address } from "viem";
import { DAY } from "./limits";

export { DAY };

export interface PulseStatus {
  current: number;
  lastStreak: number;
  best: number;
  total: number;
  lastDay: bigint;
  nextCheckInAt: bigint;
  checkedInToday: boolean;
  streakAlive: boolean;
}

export interface PulseLog {
  user: Address;
  day: bigint;
  streak: number;
  best: number;
  brokenFrom: number;
  blockNumber?: bigint;
}

export interface HeatmapCell {
  day: bigint;
  date: string;
  checkedIn: boolean;
  streak: number;
  isToday: boolean;
}

export interface LeaderboardRow {
  rank: number;
  user: Address;
  best: number;
  current: number;
  total: number;
  streakAlive: boolean;
  firstSeenDay: bigint;
}

/**
 * UTC day index for a given unix timestamp in seconds.
 */
export function utcDay(ts: number): bigint {
  return BigInt(Math.floor(ts / DAY));
}

/**
 * Unix timestamp in seconds of the next UTC midnight.
 */
export function nextMidnight(ts: number): number {
  return (Math.floor(ts / DAY) + 1) * DAY;
}

/**
 * Format a duration in seconds into HH:MM:SS.
 */
export function formatCountdown(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export type StreakPhase = "never" | "ready" | "done" | "atRisk" | "ended";

export interface ViewDerivation {
  phase: StreakPhase;
  label: string;
  hoursLeft?: number;
  nextDayNumber: number;
}

/**
 * Derives the active UI phase and copy based on status and current time.
 */
export function deriveView(status: PulseStatus, nowSec: number): ViewDerivation {
  const currentUtcDay = utcDay(nowSec);

  if (status.total === 0 || status.lastDay === 0n) {
    return {
      phase: "never",
      label: "Check in — day 1",
      nextDayNumber: 1,
    };
  }

  if (status.checkedInToday || status.lastDay === currentUtcDay) {
    return {
      phase: "done",
      label: "Done for today.",
      nextDayNumber: status.current,
    };
  }

  // Not checked in today
  const hoursLeft = Math.max(0, Math.floor((nextMidnight(nowSec) - nowSec) / 3600));

  if (status.streakAlive && status.lastDay === currentUtcDay - 1n) {
    return {
      phase: "atRisk",
      label: `${hoursLeft} hours left in this UTC day`,
      hoursLeft,
      nextDayNumber: status.current + 1,
    };
  }

  return {
    phase: "ended",
    label: `Streak ended at ${status.lastStreak} — start again today.`,
    nextDayNumber: 1,
  };
}

/**
 * Build 105 calendar cells (15 weeks of 7 days) ending at endDay.
 */
export function buildHeatmap(logs: PulseLog[], endDay: bigint): HeatmapCell[] {
  const totalCells = 15 * 7; // 105 days
  const startDay = endDay - BigInt(totalCells - 1);

  const logByDay = new Map<bigint, PulseLog>();
  for (const log of logs) {
    logByDay.set(log.day, log);
  }

  const cells: HeatmapCell[] = [];
  for (let i = 0; i < totalCells; i++) {
    const day = startDay + BigInt(i);
    const daySec = Number(day) * DAY;
    const dateStr = new Date(daySec * 1000).toISOString().split("T")[0];
    const log = logByDay.get(day);

    cells.push({
      day,
      date: dateStr,
      checkedIn: Boolean(log),
      streak: log ? log.streak : 0,
      isToday: day === endDay,
    });
  }

  return cells;
}

/**
 * Aggregate logs to produce a ranked leaderboard of up to 10 wallets.
 * Ranking criteria:
 * 1. Best streak (descending)
 * 2. Total check-ins (descending)
 * 3. Earliest first seen day (ascending)
 */
export function leaderboard(logs: PulseLog[], currentDay?: bigint): LeaderboardRow[] {
  const userStats = new Map<
    string,
    {
      user: Address;
      best: number;
      current: number;
      total: number;
      lastDay: bigint;
      firstSeenDay: bigint;
    }
  >();

  for (const log of logs) {
    const key = log.user.toLowerCase();
    const existing = userStats.get(key);
    if (!existing) {
      userStats.set(key, {
        user: log.user,
        best: log.best,
        current: log.streak,
        total: 1,
        lastDay: log.day,
        firstSeenDay: log.day,
      });
    } else {
      existing.total += 1;
      if (log.best > existing.best) existing.best = log.best;
      if (log.day > existing.lastDay) {
        existing.lastDay = log.day;
        existing.current = log.streak;
      }
      if (log.day < existing.firstSeenDay) {
        existing.firstSeenDay = log.day;
      }
    }
  }

  const today = currentDay ?? (logs.length > 0 ? logs.reduce((max, l) => l.day > max ? l.day : max, 0n) : 0n);

  const entries = Array.from(userStats.values()).map((entry) => {
    const streakAlive = entry.lastDay !== 0n && entry.lastDay + 1n >= today;
    return {
      ...entry,
      streakAlive,
    };
  });

  entries.sort((a, b) => {
    if (b.best !== a.best) return b.best - a.best;
    if (b.total !== a.total) return b.total - a.total;
    if (a.firstSeenDay < b.firstSeenDay) return -1;
    if (a.firstSeenDay > b.firstSeenDay) return 1;
    return a.user.localeCompare(b.user);
  });

  return entries.slice(0, 10).map((entry, idx) => ({
    rank: idx + 1,
    user: entry.user,
    best: entry.best,
    current: entry.streakAlive ? entry.current : 0,
    total: entry.total,
    streakAlive: entry.streakAlive,
    firstSeenDay: entry.firstSeenDay,
  }));
}

/**
 * Format address for display (0x1234...abcd).
 */
export function formatAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
