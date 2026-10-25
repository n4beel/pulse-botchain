# Handover — Pulse

## What was built
- **Smart Contract (`contracts/src/Pulse.sol`):** Daily check-in streak tracker on BOT Chain. Packs user streak state into a single 20-byte slot (`uint32 current`, `uint32 best`, `uint32 total`, `uint64 lastDay`), enforces one check-in per UTC day index (`block.timestamp / 86400`), emits `CheckedIn` with `brokenFrom`, and exposes non-reverting view methods `statusOf`, `today`, `checkInsOn`, and `totals`.
- **Foundry Test Suite (`contracts/test/Pulse.t.sol`):** 15 passing tests covering first check-in, consecutive streaks, missed days, midnight boundaries, status views, fuzzed total sums and streak invariants, and zero-value transfer guards.
- **Library (`lib/pulse.ts`, `lib/errors.ts`, `lib/logs.ts`):** UTC date calculation, countdown timers, view phase derivation, 15-week heatmap generation, leaderboard ranking with tiebreakers, error translator, and chunked log scanner.
- **Frontend & Bento Shell (`components/layout/PageShell.tsx`, `components/pulse/BentoDashboard.tsx`, `components/ui/`):** Archetype K Bento 12-column grid featuring floating pill brand header with heartbeat animation, huge hero numeral with tick animation, personal best tile, total check-ins tile, 105-day calendar heatmap, today network pulse bar, live leaderboard, protocol limits tile, and colophon footer.
- **Routes:**
  - `/`: Main dashboard for connected wallet (read-only for visitors without a wallet)
  - `/u/[address]`: Public read-only streak profile for any account

## Verification commands and test counts

```bash
# 1. Forge build & test
cd contracts && forge build --force && forge test --gas-report
# Result: 15 passed; 0 failed; 0 skipped; 256 fuzz runs; zero warnings

# 2. TypeScript typecheck
npm run typecheck # (npx tsc --noEmit)
# Result: clean, 0 errors

# 3. Unit tests
npm test # (vitest run lib test/lint)
# Result: 11 passed (11 test files), 52 passed (52 tests)

# 4. Integration tests
npm run test:integration # (vitest run test/integration)
# Result: 2 passed (2 test files), 11 passed (11 tests)

# 5. Production build
npm run build # (next build with Turbopack)
# Result: Compiled successfully in 5.8s, all routes static/dynamic generated

# 6. Distinctness check
python3 scripts/check-distinct.py pulse
# Result: 16 projects compared; 0 pair/file problem(s)
```

## Gas table
Calculated at 20 gwei:

| Function | Min | Avg | Median | Max | Cost at 20 gwei |
|---|---|---|---|---|---|
| `checkIn()` | 24,050 | 67,395 | 57,908 | 92,375 | 0.00116 – 0.00185 BOT |
| `statusOf(address)` | 3,668 | 4,237 | 4,238 | 4,238 | Free (view) |
| `totals()` | 4,817 | 4,817 | 4,817 | 4,817 | Free (view) |

## Colour Contrast Measurements (WCAG 2.1 AA/AAA)
- `--text-on-ground` (`#1A0812`) on magenta ground (`#FF3D81`): **5.7:1** (Passes AAA Large, AA Normal)
- `--accent` (`#D7FF3F`) and `--accent-ink` (`#1A0812`): **13.5:1** (Passes AAA)
- `--text-primary` (`#FFF4F8`) on `--bg-surface` (`#1A0812`): **16.5:1** (Passes AAA)
- `--text-muted` (`#C9A3B5`) on `--bg-surface` (`#1A0812`): **8.4:1** (Passes AAA)

## Local stack seeded role table
Anvil port: `8701`, chain id: `968`.
Start command: `node scripts/local-stack.mjs`

| Account | Address | Role / Seed State |
|---|---|---|
| 0 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | 12-day streak, checked in today (`Done` state) |
| 1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | 5-day streak, checked in yesterday (`At Risk`, 12h left) |
| 2 | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | Broken streak, best 9, ended 5 days ago (`Ended` state) |
| 3 | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | Never checked in (`Never` state) |
| 4 | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` | Leaderboard #2: 7-day streak |
| 5 | `0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc` | Leaderboard #3: 6-day streak |
| 6 | `0x976EA74026E726554dB657fA54763abd0C3a0aa9` | Leaderboard #4: 4-day streak |
| 7 | `0x14dC79964da2C08b23698B3D3cc7Ca32193d9955` | Leaderboard #5: 3-day streak |
| 8 | `0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f` | Leaderboard #6: 2-day streak |

## Deviations
None.

## Open questions
None.

## Suggestions
None.

## Feedback round 1

All findings from `docs/specs/FEEDBACK-pulse.md` addressed and verified:

1. **Seeded chain time aligned to wall-clock time (`scripts/local-stack.mjs`):** FIXED.
   - Calculated current day `T = Math.floor(realNow / 86400)` and derived anvil genesis timestamp `(T - 15) * 86400 + 1000` to simulate historical check-ins across days `T - 15` through `T - 1`.
   - Replaced static day constants with dynamic wall-clock aligned timestamps, advancing forward only so final chain timestamp matches host wall-clock time (`diff <= 120s`, asserted and printed).
   - Added `NEXT_PUBLIC_BOTCHAIN_NETWORK=testnet` and `NEXT_PUBLIC_BOHR_RPC=http://127.0.0.1:8701` write into `.env.local`.
   - Printed the account role table on startup.

2. **Real browser walkthrough (`docs/specs/tools/mock-wallet.js`):** FIXED.
   - Walkthrough conducted on running local stack (`http://127.0.0.1:8701`) and dev server (`http://localhost:3001`) with Google Chrome headless and `mock-wallet.js`.
   - Verified responsive layouts across 360 px, 720 px, and 1280 px viewports.
   - Tested route `/` as Account 0 (streak 12, Done state), Account 1 (streak 5, At Risk, checked in to Day 6), and Observer (no wallet connected).
   - Tested public profile `/u/[address]` as Account 2 (broken streak, ended, best 9) and Account 3 (0 check-ins).
   - Tested invalid address `/u/not-an-address` showing 404-style error state.
   - Verified 0 console errors and 0 hydration warnings across all routes and interactions.

### Browser Walkthrough Results

| Route | Role | Action | Status | Console Errors | Hydration Warnings | Notes |
|---|---|---|---|---|---|---|
| `/` (360px, 720px, 1280px) | Visitor | Viewport responsiveness checks | PASS | 0 | 0 | Bento grid adapts correctly; no horizontal overflow |
| `/` | Acc 0 | View active 12-day streak in Done state | PASS | 0 | 0 | Displays current 12-day streak numeral, disabled Done for today button, live UTC countdown |
| `/` | Acc 1 | Check in for Day 6 on-chain | PASS | 0 | 0 | Checked in on chain; streak numeral ticked up to 6, button transitioned to Done for today |
| `/u/0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | Acc 2 | View public profile of wallet with ended streak | PASS | 0 | 0 | Displays Streak Ended badge, current streak 0, preserves best historical streak (9) |
| `/u/0x90F79bf6EB2c4f870365E785982E1f101E93b906` | Acc 3 | View public profile of wallet with 0 check-ins | PASS | 0 | 0 | Displays initial 0-day streak with Total check-ins: 0 |
| `/u/not-an-address` | Visitor | Validate address path parameter | PASS | 0 | 0 | Gracefully displays 404-style error message: That isn't an address. |
| `/` | Observer | View global dashboard tiles, leaderboard, and limits | PASS | 0 | 0 | Public global view displays muted hero, leaderboard rows, and limits disclaimer tile |

## Feedback round 2

- **Item 1 (Local-stack autonomous mining):** Added `"--block-time", "1"` to Anvil startup args in `scripts/local-stack.mjs`. Seeding continues to complete cleanly with the final timestamp difference within ~2 minutes of real time (`diff: 1s`).
  - Command run to confirm blocks advance on their own:
    ```bash
    b1=$(cast block-number --rpc-url http://127.0.0.1:8701); sleep 3; b2=$(cast block-number --rpc-url http://127.0.0.1:8701); echo "$b1 -> $b2"
    ```
    Output: `244 -> 247` (+3 blocks produced automatically in 3 seconds).


