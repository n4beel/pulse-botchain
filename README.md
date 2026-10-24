# Pulse

Check in once a day. Keep the streak.

Pulse is an un-fakeable daily habit marker on BOT Chain. Each wallet can check in once per UTC day to build or maintain a daily streak.

## What it does
- **Daily Check-In:** Call `checkIn()` once per UTC day to increment your streak count.
- **Streak Preservation:** Missing a UTC day resets your active streak to 1 on your next check-in while keeping your all-time best.
- **Public Habit Dashboard:** Anyone can view any wallet's streak, calendar heatmap, and lifetime totals at `/u/<address>`.
- **Live Leaderboard:** Tracks the top 10 daily streaks across the network.

## What it deliberately cannot do
- **No double check-ins:** Only one check-in per UTC day per wallet. Enforced unconditionally on chain; nobody can check in twice.
- **No human verification:** It cannot tell people apart. A streak proves that a private key showed up, not a human.
- **No forgiveness or buybacks:** A missed UTC day cannot be repaired, forgiven, or recovered.
- **No funds or tokens:** No native BOT or ERC-20 tokens are ever deposited, transferred, or locked.
- **No admin or owner:** No owner keys, pause controls, or upgradeability.

## Gas profile
Calculated at 20 gwei gas price:

| Operation | Gas Used | Cost (BOT at 20 gwei) |
|---|---|---|
| `checkIn()` (first check-in) | 92,375 | ~0.00185 BOT |
| `checkIn()` (repeat consecutive day) | 57,908 | ~0.00116 BOT |
| `statusOf(address)` | 4,238 (view) | Free |
| `totals()` | 4,817 (view) | Free |

## Development & Local Stack

Run the local stack with rich seeded accounts (chain id 968 on port 8701):
```bash
node scripts/local-stack.mjs
npm run dev
```

Run tests:
```bash
# Contract tests
cd contracts && forge test --gas-report

# Frontend unit & lint tests
npm test

# Integration tests on live anvil node
npm run test:integration
```

## Contract deployments
- **Mainnet (Chain ID 677):** `TBD` (Deploy block: `TBD`)
- **Bohr Testnet (Chain ID 968):** `TBD` (Deploy block: `TBD`)

Explorer: [https://scan.botchain.ai](https://scan.botchain.ai)
