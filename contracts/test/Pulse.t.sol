// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Test} from "forge-std/Test.sol";
import {Pulse} from "../src/Pulse.sol";

contract PulseTest is Test {
  Pulse public pulse;
  uint256 public constant DAY = 86_400;

  event CheckedIn(
    address indexed user,
    uint64 indexed day,
    uint32 streak,
    uint32 best,
    uint32 brokenFrom
  );

  function setUp() public {
    // Warp to a realistic timestamp: 1_760_000_000 is ~Oct 2025
    vm.warp(1_760_000_000);
    pulse = new Pulse();
  }

  function test_FirstCheckInStartsAtOne() public {
    address alice = makeAddr("alice");
    vm.prank(alice);
    pulse.checkIn();

    Pulse.Status memory status = pulse.statusOf(alice);
    assertEq(status.current, 1);
    assertEq(status.best, 1);
    assertEq(status.total, 1);
    assertEq(status.lastStreak, 1);
    // forge-lint: disable-next-line(unsafe-typecast)
    assertEq(status.lastDay, uint64(1_760_000_000 / DAY));
    assertTrue(status.checkedInToday);
    assertTrue(status.streakAlive);
  }

  function test_ConsecutiveDaysExtend() public {
    address alice = makeAddr("alice");

    vm.prank(alice);
    pulse.checkIn();

    // Advance 1 day
    vm.warp(block.timestamp + DAY);
    vm.prank(alice);
    pulse.checkIn();

    // Advance another day
    vm.warp(block.timestamp + DAY);
    vm.prank(alice);
    pulse.checkIn();

    Pulse.Status memory status = pulse.statusOf(alice);
    assertEq(status.current, 3);
    assertEq(status.best, 3);
    assertEq(status.total, 3);
    assertTrue(status.streakAlive);
  }

  function test_MissedDayResetsToOneAndKeepsBest() public {
    address alice = makeAddr("alice");

    // 3-day streak
    for (uint256 i = 0; i < 3; i++) {
      vm.prank(alice);
      pulse.checkIn();
      vm.warp(block.timestamp + DAY);
    }

    // Skip a day (advance 2 days instead of 1)
    vm.warp(block.timestamp + DAY);

    vm.prank(alice);
    pulse.checkIn();

    Pulse.Status memory status = pulse.statusOf(alice);
    assertEq(status.current, 1);
    assertEq(status.best, 3);
    assertEq(status.total, 4);
    assertEq(status.lastStreak, 1);
    assertTrue(status.checkedInToday);
  }

  function test_SecondCallSameDayReverts() public {
    address alice = makeAddr("alice");

    vm.prank(alice);
    pulse.checkIn();

    // forge-lint: disable-next-line(unsafe-typecast)
    uint64 currentDay = uint64(block.timestamp / DAY);
    // forge-lint: disable-next-line(unsafe-typecast)
    uint64 nextAt = uint64((currentDay + 1) * DAY);

    vm.expectRevert(abi.encodeWithSelector(Pulse.AlreadyCheckedIn.selector, currentDay, nextAt));
    vm.prank(alice);
    pulse.checkIn();
  }

  function test_RevertsAt235959_AllowsAtMidnight() public {
    address alice = makeAddr("alice");

    // Align to start of day
    uint256 todayStart = block.timestamp - (block.timestamp % DAY);
    vm.warp(todayStart + 100); // 100s into today

    vm.prank(alice);
    pulse.checkIn();

    // Warp to 23:59:59 of same day
    vm.warp(todayStart + DAY - 1);
    // forge-lint: disable-next-line(unsafe-typecast)
    uint64 currentDay = uint64(todayStart / DAY);
    // forge-lint: disable-next-line(unsafe-typecast)
    uint64 nextAt = uint64((currentDay + 1) * DAY);

    vm.expectRevert(abi.encodeWithSelector(Pulse.AlreadyCheckedIn.selector, currentDay, nextAt));
    vm.prank(alice);
    pulse.checkIn();

    // Warp to exactly midnight (start of next day)
    vm.warp(todayStart + DAY);
    vm.prank(alice);
    pulse.checkIn();

    Pulse.Status memory status = pulse.statusOf(alice);
    assertEq(status.current, 2);
  }

  function test_StatusOf_EffectiveStreakIsZeroWhenBroken_LastStreakKept() public {
    address alice = makeAddr("alice");

    vm.prank(alice);
    pulse.checkIn();
    vm.warp(block.timestamp + DAY);
    vm.prank(alice);
    pulse.checkIn();

    // Warp 2 days into the future without checking in
    vm.warp(block.timestamp + (2 * DAY));

    Pulse.Status memory status = pulse.statusOf(alice);
    assertEq(status.current, 0); // Effective streak is 0
    assertEq(status.lastStreak, 2); // Raw current streak kept
    assertEq(status.best, 2);
    assertFalse(status.streakAlive);
    assertFalse(status.checkedInToday);
    assertEq(status.nextCheckInAt, 0); // Can check in now
  }

  function test_StatusOf_NextCheckInAtIsMidnight() public {
    address alice = makeAddr("alice");
    uint256 todayStart = block.timestamp - (block.timestamp % DAY);
    vm.warp(todayStart + 3600); // 1 hour into day

    vm.prank(alice);
    pulse.checkIn();

    Pulse.Status memory status = pulse.statusOf(alice);
    assertEq(status.nextCheckInAt, todayStart + DAY);
    assertTrue(status.checkedInToday);
  }

  function test_StatusOf_NeverCheckedIn() public {
    address stranger = makeAddr("stranger");
    Pulse.Status memory status = pulse.statusOf(stranger);

    assertEq(status.current, 0);
    assertEq(status.lastStreak, 0);
    assertEq(status.best, 0);
    assertEq(status.total, 0);
    assertEq(status.lastDay, 0);
    assertEq(status.nextCheckInAt, 0);
    assertFalse(status.checkedInToday);
    assertFalse(status.streakAlive);
  }

  function test_BrokenFromInEvent() public {
    address alice = makeAddr("alice");
    // forge-lint: disable-next-line(unsafe-typecast)
    uint64 day0 = uint64(block.timestamp / DAY);

    // First check-in: brokenFrom = 0
    vm.expectEmit(true, true, false, true);
    emit CheckedIn(alice, day0, 1, 1, 0);
    vm.prank(alice);
    pulse.checkIn();

    // Day 2 (streak extended): brokenFrom = 0
    vm.warp(block.timestamp + DAY);
    // forge-lint: disable-next-line(unsafe-typecast)
    uint64 day1 = uint64(block.timestamp / DAY);
    vm.expectEmit(true, true, false, true);
    emit CheckedIn(alice, day1, 2, 2, 0);
    vm.prank(alice);
    pulse.checkIn();

    // Skip 2 days (broken streak): brokenFrom = 2
    vm.warp(block.timestamp + (2 * DAY));
    // forge-lint: disable-next-line(unsafe-typecast)
    uint64 day3 = uint64(block.timestamp / DAY);
    vm.expectEmit(true, true, false, true);
    emit CheckedIn(alice, day3, 1, 2, 2);
    vm.prank(alice);
    pulse.checkIn();
  }

  function test_PerDayCountsAndTotals() public {
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    // forge-lint: disable-next-line(unsafe-typecast)
    uint64 day0 = uint64(block.timestamp / DAY);

    vm.prank(alice);
    pulse.checkIn();
    vm.prank(bob);
    pulse.checkIn();

    assertEq(pulse.checkInsOn(day0), 2);
    (uint64 totalCheckIns, uint32 participants, uint32 todayCount) = pulse.totals();
    assertEq(totalCheckIns, 2);
    assertEq(participants, 2);
    assertEq(todayCount, 2);

    // Next day, only alice checks in
    vm.warp(block.timestamp + DAY);
    // forge-lint: disable-next-line(unsafe-typecast)
    uint64 day1 = uint64(block.timestamp / DAY);
    vm.prank(alice);
    pulse.checkIn();

    assertEq(pulse.checkInsOn(day1), 1);
    (totalCheckIns, participants, todayCount) = pulse.totals();
    assertEq(totalCheckIns, 3);
    assertEq(participants, 2);
    assertEq(todayCount, 1);
  }

  function test_ParticipantsCountsEachWalletOnce() public {
    address alice = makeAddr("alice");

    assertEq(pulse.participants(), 0);

    vm.prank(alice);
    pulse.checkIn();
    assertEq(pulse.participants(), 1);

    vm.warp(block.timestamp + DAY);
    vm.prank(alice);
    pulse.checkIn();
    assertEq(pulse.participants(), 1);
  }

  function testFuzz_TotalsMatchSumOfPerWalletTotals(
    address[5] memory wallets,
    uint8[5] memory dayGaps
  ) public {
    uint256 expectedTotalCheckIns = 0;
    for (uint256 w = 0; w < wallets.length; w++) {
      vm.assume(wallets[w] != address(0));
      // avoid duplicates in the array
      for (uint256 k = 0; k < w; k++) {
        vm.assume(wallets[w] != wallets[k]);
      }
    }

    for (uint256 w = 0; w < wallets.length; w++) {
      uint256 gap = (uint256(dayGaps[w]) % 5) + 1; // 1 to 5 days
      vm.warp(block.timestamp + (gap * DAY));
      vm.prank(wallets[w]);
      pulse.checkIn();
      expectedTotalCheckIns++;
    }

    (uint64 totalCheckIns, uint32 participants, ) = pulse.totals();
    assertEq(totalCheckIns, expectedTotalCheckIns);
    assertEq(participants, wallets.length);
  }

  function testFuzz_StreakNeverExceedsTotal(uint8 numDays) public {
    address alice = makeAddr("alice");
    uint256 daysCount = (uint256(numDays) % 30) + 1;

    for (uint256 i = 0; i < daysCount; i++) {
      vm.prank(alice);
      pulse.checkIn();
      Pulse.Status memory status = pulse.statusOf(alice);
      assertLe(status.current, status.total);
      assertGe(status.best, status.current);
      vm.warp(block.timestamp + DAY);
    }
  }

  function test_NoBalance_NoReceive() public {
    (bool ok, ) = address(pulse).call{value: 1 ether}("");
    assertFalse(ok);
    assertEq(address(pulse).balance, 0);
  }

  function test_GasSnapshot() public {
    address alice = makeAddr("alice");

    // First check-in
    uint256 g0 = gasleft();
    vm.prank(alice);
    pulse.checkIn();
    uint256 firstGas = g0 - gasleft();

    // Repeat day check-in
    vm.warp(block.timestamp + DAY);
    uint256 g1 = gasleft();
    vm.prank(alice);
    pulse.checkIn();
    uint256 repeatGas = g1 - gasleft();

    // Verify expectations: first < 110k, repeat < 65k
    assertLt(firstGas, 110_000, "First check-in gas too high");
    assertLt(repeatGas, 65_000, "Repeat check-in gas too high");
  }
}
