import { describe, expect, it } from "vitest";
import {
  buildHeatmap,
  deriveView,
  formatCountdown,
  leaderboard,
  nextMidnight,
  utcDay,
  type PulseLog,
  type PulseStatus,
} from "../pulse";

describe("pulse core utilities", () => {
  it("computes utcDay correctly", () => {
    expect(utcDay(0)).toBe(0n);
    expect(utcDay(86399)).toBe(0n);
    expect(utcDay(86400)).toBe(1n);
    expect(utcDay(1760000000)).toBe(20370n);
  });

  it("computes nextMidnight correctly", () => {
    expect(nextMidnight(0)).toBe(86400);
    expect(nextMidnight(86399)).toBe(86400);
    expect(nextMidnight(86400)).toBe(172800);
    expect(nextMidnight(1760000000)).toBe(20371 * 86400);
  });

  it("formats countdown string correctly", () => {
    expect(formatCountdown(0)).toBe("00:00:00");
    expect(formatCountdown(59)).toBe("00:00:59");
    expect(formatCountdown(3665)).toBe("01:01:05");
    expect(formatCountdown(86399)).toBe("23:59:59");
  });

  describe("deriveView", () => {
    const fixedNow = 1760000000; // day = 20370n
    const todayDay = utcDay(fixedNow);

    it("handles never checked in", () => {
      const status: PulseStatus = {
        current: 0,
        lastStreak: 0,
        best: 0,
        total: 0,
        lastDay: 0n,
        nextCheckInAt: 0n,
        checkedInToday: false,
        streakAlive: false,
      };
      const res = deriveView(status, fixedNow);
      expect(res.phase).toBe("never");
      expect(res.nextDayNumber).toBe(1);
    });

    it("handles checked in today (done)", () => {
      const status: PulseStatus = {
        current: 5,
        lastStreak: 5,
        best: 5,
        total: 5,
        lastDay: todayDay,
        nextCheckInAt: BigInt(nextMidnight(fixedNow)),
        checkedInToday: true,
        streakAlive: true,
      };
      const res = deriveView(status, fixedNow);
      expect(res.phase).toBe("done");
      expect(res.label).toBe("Done for today.");
      expect(res.nextDayNumber).toBe(5);
    });

    it("handles at risk streak (checked in yesterday)", () => {
      const status: PulseStatus = {
        current: 5,
        lastStreak: 5,
        best: 5,
        total: 5,
        lastDay: todayDay - 1n,
        nextCheckInAt: 0n,
        checkedInToday: false,
        streakAlive: true,
      };
      const res = deriveView(status, fixedNow);
      expect(res.phase).toBe("atRisk");
      expect(res.nextDayNumber).toBe(6);
      expect(res.hoursLeft).toBeDefined();
    });

    it("handles ended streak", () => {
      const status: PulseStatus = {
        current: 0,
        lastStreak: 5,
        best: 5,
        total: 5,
        lastDay: todayDay - 3n,
        nextCheckInAt: 0n,
        checkedInToday: false,
        streakAlive: false,
      };
      const res = deriveView(status, fixedNow);
      expect(res.phase).toBe("ended");
      expect(res.nextDayNumber).toBe(1);
      expect(res.label).toContain("Streak ended at 5");
    });
  });

  describe("buildHeatmap", () => {
    it("builds 105 calendar cells ending at endDay", () => {
      const endDay = 20370n;
      const logs: PulseLog[] = [
        {
          user: "0x1111111111111111111111111111111111111111",
          day: endDay - 1n,
          streak: 4,
          best: 4,
          brokenFrom: 0,
        },
        {
          user: "0x1111111111111111111111111111111111111111",
          day: endDay,
          streak: 5,
          best: 5,
          brokenFrom: 0,
        },
      ];

      const cells = buildHeatmap(logs, endDay);
      expect(cells.length).toBe(105);
      expect(cells[104].day).toBe(endDay);
      expect(cells[104].isToday).toBe(true);
      expect(cells[104].checkedIn).toBe(true);
      expect(cells[104].streak).toBe(5);

      expect(cells[103].day).toBe(endDay - 1n);
      expect(cells[103].isToday).toBe(false);
      expect(cells[103].checkedIn).toBe(true);
      expect(cells[103].streak).toBe(4);

      expect(cells[0].day).toBe(endDay - 104n);
      expect(cells[0].checkedIn).toBe(false);
    });
  });

  describe("leaderboard", () => {
    it("ranks wallets by best streak, then total check-ins, then earliest day", () => {
      const addrA = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
      const addrB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
      const addrC = "0xcccccccccccccccccccccccccccccccccccccccc" as const;

      const logs: PulseLog[] = [
        // A has best 5, total 5
        { user: addrA, day: 100n, streak: 1, best: 1, brokenFrom: 0 },
        { user: addrA, day: 101n, streak: 2, best: 2, brokenFrom: 0 },
        { user: addrA, day: 102n, streak: 3, best: 3, brokenFrom: 0 },
        { user: addrA, day: 103n, streak: 4, best: 4, brokenFrom: 0 },
        { user: addrA, day: 104n, streak: 5, best: 5, brokenFrom: 0 },
        // B has best 8, total 8
        { user: addrB, day: 95n, streak: 1, best: 1, brokenFrom: 0 },
        { user: addrB, day: 102n, streak: 8, best: 8, brokenFrom: 0 },
        // C has best 5, total 6 (more total than A)
        { user: addrC, day: 90n, streak: 1, best: 1, brokenFrom: 0 },
        { user: addrC, day: 91n, streak: 2, best: 2, brokenFrom: 0 },
        { user: addrC, day: 92n, streak: 3, best: 3, brokenFrom: 0 },
        { user: addrC, day: 93n, streak: 4, best: 4, brokenFrom: 0 },
        { user: addrC, day: 94n, streak: 5, best: 5, brokenFrom: 0 },
        { user: addrC, day: 104n, streak: 1, best: 5, brokenFrom: 5 },
      ];

      const board = leaderboard(logs, 104n);
      expect(board.length).toBe(3);
      // Rank 1: B (best = 8)
      expect(board[0].user).toBe(addrB);
      expect(board[0].best).toBe(8);
      expect(board[0].rank).toBe(1);

      // Rank 2: C (best = 5, total = 6)
      expect(board[1].user).toBe(addrC);
      expect(board[1].best).toBe(5);
      expect(board[1].total).toBe(6);
      expect(board[1].rank).toBe(2);

      // Rank 3: A (best = 5, total = 5)
      expect(board[2].user).toBe(addrA);
      expect(board[2].best).toBe(5);
      expect(board[2].total).toBe(5);
      expect(board[2].rank).toBe(3);
    });
  });
});
