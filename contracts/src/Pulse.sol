// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/// @title Pulse
/// @notice Daily check-in streak tracker on BOT Chain.
/// @dev One check-in per UTC day per wallet. Rate-limited counter keyed by calendar day.
/// No funds, no tokens, no time-lock, no second party.
/// What this cannot do:
/// - One check-in per UTC day per wallet, enforced by contract; nobody can check in twice.
/// - It cannot tell people apart: one person with ten wallets has ten streaks.
/// - A missed day cannot be repaired, bought back, or forgiven.
/// - Stores counts and dates only — no names, no messages.
/// - No owner, no admin, no pause, no upgradeability.
/// - No funds accepted (no payable, no receive/fallback).
contract Pulse {
  /// @notice One day in seconds (86,400)
  uint256 public constant DAY = 86400;

  /// @dev Packed into one 20-byte slot: 4 + 4 + 4 + 8 = 20 bytes.
  /// Saves ~22k gas on first write by keeping user streak state in a single storage slot.
  struct Streak {
    uint32 current;     // raw streak as of lastDay (may be stale — see statusOf)
    uint32 best;        // longest streak ever
    uint32 total;       // check-ins ever
    uint64 lastDay;     // UTC day index of last check-in; 0 = never
  }

  /// @notice Comprehensive status view for a wallet
  struct Status {
    uint32 current;       // EFFECTIVE streak: 0 if broken (lastDay + 1 < today)
    uint32 lastStreak;    // raw `current` (what it was when it ended, if broken)
    uint32 best;
    uint32 total;
    uint64 lastDay;
    uint64 nextCheckInAt; // 0 if can check in now; else unix time of next UTC midnight
    bool checkedInToday;
    bool streakAlive;     // lastDay != 0 && lastDay + 1 >= today
  }

  mapping(address => Streak) private _streaks;
  mapping(uint64 day => uint32 count) private _perDay;

  /// @notice Total check-ins recorded across all wallets
  uint64 public totalCheckIns;
  /// @notice Total distinct wallets that have ever checked in
  uint32 public participants;

  /// @notice Emitted whenever a wallet checks in
  /// @param user Address of the checking-in wallet
  /// @param day UTC day index
  /// @param streak Current streak after this check-in
  /// @param best Best streak ever after this check-in
  /// @param brokenFrom Previous streak if the streak was broken, else 0
  event CheckedIn(
    address indexed user,
    uint64 indexed day,
    uint32 streak,
    uint32 best,
    uint32 brokenFrom
  );

  /// @notice Reverted when a wallet attempts to check in more than once in the same UTC day
  /// @param day Current UTC day index
  /// @param nextAt Unix timestamp when the next check-in window opens (next UTC midnight)
  error AlreadyCheckedIn(uint64 day, uint64 nextAt);

  /// @notice Current UTC day index
  function today() public view returns (uint64) {
    // casting to 'uint64' is safe because block.timestamp / DAY fits uint64
    // forge-lint: disable-next-line(unsafe-typecast)
    return uint64(block.timestamp / DAY);
  }

  /// @notice Check in for the current UTC day and extend or restart streak
  function checkIn() external {
    uint64 todayDay = today();
    Streak memory s = _streaks[msg.sender];

    if (s.lastDay == todayDay) {
      // casting to 'uint64' is safe because next midnight unix timestamp fits uint64
      // forge-lint: disable-next-line(unsafe-typecast)
      revert AlreadyCheckedIn(todayDay, uint64((todayDay + 1) * DAY));
    }

    uint32 brokenFrom = 0;
    uint32 current;

    if (s.lastDay == 0) {
      current = 1;
      participants++;
    } else if (s.lastDay == todayDay - 1) {
      current = s.current + 1;
    } else {
      // Streak broken: lastDay < todayDay - 1
      brokenFrom = s.current;
      current = 1;
    }

    uint32 best = s.best;
    if (current > best) {
      best = current;
    }

    uint32 total = s.total + 1;

    _streaks[msg.sender] = Streak({
      current: current,
      best: best,
      total: total,
      lastDay: todayDay
    });

    _perDay[todayDay]++;
    totalCheckIns++;

    emit CheckedIn(msg.sender, todayDay, current, best, brokenFrom);
  }

  /// @notice Read full status for any address without reverting
  /// @param user Address to inspect
  function statusOf(address user) external view returns (Status memory) {
    uint64 todayDay = today();
    Streak memory s = _streaks[user];

    if (s.lastDay == 0) {
      return Status({
        current: 0,
        lastStreak: 0,
        best: 0,
        total: 0,
        lastDay: 0,
        nextCheckInAt: 0,
        checkedInToday: false,
        streakAlive: false
      });
    }

    bool checkedInToday = (s.lastDay == todayDay);
    bool streakAlive = (s.lastDay + 1 >= todayDay);
    uint32 current = streakAlive ? s.current : 0;
    // casting to 'uint64' is safe because next midnight unix timestamp fits uint64
    // forge-lint: disable-next-line(unsafe-typecast)
    uint64 nextCheckInAt = checkedInToday ? uint64((todayDay + 1) * DAY) : 0;

    return Status({
      current: current,
      lastStreak: s.current,
      best: s.best,
      total: s.total,
      lastDay: s.lastDay,
      nextCheckInAt: nextCheckInAt,
      checkedInToday: checkedInToday,
      streakAlive: streakAlive
    });
  }

  /// @notice Number of check-ins recorded on a specific UTC day
  /// @param day UTC day index
  function checkInsOn(uint64 day) external view returns (uint32) {
    return _perDay[day];
  }

  /// @notice Snapshot of global activity for dashboard headers
  /// @return checkIns Total check-ins recorded
  /// @return wallets Total unique wallets
  /// @return todayCount Number of check-ins today
  function totals() external view returns (uint64 checkIns, uint32 wallets, uint32 todayCount) {
    return (totalCheckIns, participants, _perDay[today()]);
  }
}
