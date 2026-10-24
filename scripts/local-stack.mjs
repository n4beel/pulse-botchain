/**
 * Local stack runner and seeder for Pulse.
 *
 * Spawns anvil on port 8701 with chain id 968, deploys Pulse, and seeds
 * realistic states across anvil accounts:
 * - Account 0: 12-day streak, checked in today (Done)
 * - Account 1: 5-day streak, checked in yesterday (At risk, 12h left)
 * - Account 2: Broken streak (best 9, ended days ago)
 * - Account 3: Never checked in (New user)
 * - Accounts 4-8: Varied streaks for the leaderboard
 *
 *   node scripts/local-stack.mjs
 *   npm run dev
 */

import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const PORT = 8701;
const RPC = `http://127.0.0.1:${PORT}`;
const CHAIN_ID = 968;

const KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // (0) 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // (1) 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // (2) 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // (3) 0x90F79bf6EB2c4f870365E785982E1f101E93b906
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a", // (4) 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65
  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba", // (5) 0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc
  "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e", // (6) 0x976EA74026E726554dB657fA54763abd0C3a0aa9
  "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356", // (7) 0x14dC79964da2C08b23698B3D3cc7Ca32193d9955
  "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97", // (8) 0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f
];

const local = defineChain({
  id: CHAIN_ID,
  name: "anvil",
  nativeCurrency: { name: "Test BOT", symbol: "tBOT", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

console.log(`Starting anvil on port ${PORT}...`);
spawn("anvil", ["--port", String(PORT), "--chain-id", String(CHAIN_ID), "--silent"], {
  detached: true,
  stdio: "ignore",
}).unref();

const pub = createPublicClient({ chain: local, transport: http() });
const deployerAccount = privateKeyToAccount(KEYS[0]);
const deployerWallet = createWalletClient({ account: deployerAccount, chain: local, transport: http() });

// Wait for anvil to answer
for (let i = 0; ; i++) {
  try {
    await pub.getBlockNumber();
    break;
  } catch {
    if (i > 100) throw new Error(`anvil never answered on ${RPC}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

const artifact = JSON.parse(
  readFileSync(new URL("../contracts/out/Pulse.sol/Pulse.json", import.meta.url), "utf8"),
);

// Deploy Pulse
const deployHash = await deployerWallet.deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode.object,
});
const deployed = await pub.waitForTransactionReceipt({ hash: deployHash });
const contractAddress = deployed.contractAddress;

console.log(`Pulse deployed at ${contractAddress} (block ${deployed.blockNumber})`);

const DAY = 86400;
// Target day T: ~Oct 2025 (day 20370)
const T = 20370;

// Set up wallet clients for accounts 0..8
const wallets = KEYS.map((k) =>
  createWalletClient({ account: privateKeyToAccount(k), chain: local, transport: http() }),
);

// Define check-in days for each account
// Account 0: T-11 .. T (12 days)
// Account 1: T-5 .. T-1 (5 days, missing today T)
// Account 2: T-13 .. T-5 (9 days, ended 5 days ago)
// Account 3: never
// Account 4: T-6 .. T (7 days)
// Account 5: T-5 .. T (6 days)
// Account 6: T-4 .. T-1 (4 days)
// Account 7: T-2 .. T (3 days)
// Account 8: T-1 .. T (2 days)
const schedule = new Map();

for (let d = T - 15; d <= T; d++) {
  schedule.set(d, []);
}

for (let d = T - 11; d <= T; d++) schedule.get(d).push(0);
for (let d = T - 5; d <= T - 1; d++) schedule.get(d).push(1);
for (let d = T - 13; d <= T - 5; d++) schedule.get(d).push(2);
for (let d = T - 6; d <= T; d++) schedule.get(d).push(4);
for (let d = T - 5; d <= T; d++) schedule.get(d).push(5);
for (let d = T - 4; d <= T - 1; d++) schedule.get(d).push(6);
for (let d = T - 2; d <= T; d++) schedule.get(d).push(7);
for (let d = T - 1; d <= T; d++) schedule.get(d).push(8);

// Step through days and record check-ins
for (let d = T - 15; d <= T; d++) {
  const dayTimestamp = d * DAY + 1000;
  await pub.request({ method: "evm_setTime", params: [dayTimestamp] });
  await pub.request({ method: "evm_mine", params: [] });

  const activeAccounts = schedule.get(d) || [];
  for (const accIdx of activeAccounts) {
    const w = wallets[accIdx];
    const hash = await w.writeContract({
      address: contractAddress,
      abi: artifact.abi,
      functionName: "checkIn",
    });
    await pub.waitForTransactionReceipt({ hash });
  }
}

// Warp to midday of Day T so hours left renders nicely (~12 hours left)
const finalMidDay = T * DAY + 43200;
await pub.request({ method: "evm_setTime", params: [finalMidDay] });
await pub.request({ method: "evm_mine", params: [] });

// Write .env.local
writeFileSync(
  new URL("../.env.local", import.meta.url),
  [
    "# Written by scripts/local-stack.mjs for Pulse",
    "NEXT_PUBLIC_BOTCHAIN_NETWORK=testnet",
    `NEXT_PUBLIC_BOHR_RPC=${RPC}`,
    `NEXT_PUBLIC_CONTRACT_968=${contractAddress}`,
    `NEXT_PUBLIC_DEPLOY_BLOCK_968=${deployed.blockNumber > 1n ? deployed.blockNumber - 1n : 1n}`,
    "",
  ].join("\n"),
);

console.log("\n========================================================");
console.log(`Pulse Local Stack Running on http://127.0.0.1:${PORT}`);
console.log("========================================================");
console.log("Account Role Table:");
console.log("--------------------------------------------------------");
console.log("Acc 0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (Streak: 12, Checked in today - Done)");
console.log("Acc 1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (Streak: 5, Checked in yesterday - At Risk)");
console.log("Acc 2: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC (Streak ended, Best: 9 - Broken)");
console.log("Acc 3: 0x90F79bf6EB2c4f870365E785982E1f101E93b906 (Never checked in - New User)");
console.log("Acc 4: 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 (Streak: 7, Best: 7)");
console.log("Acc 5: 0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc (Streak: 6, Best: 6)");
console.log("Acc 6: 0x976EA74026E726554dB657fA54763abd0C3a0aa9 (Streak: 4, Best: 4)");
console.log("Acc 7: 0x14dC79964da2C08b23698B3D3cc7Ca32193d9955 (Streak: 3, Best: 3)");
console.log("Acc 8: 0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f (Streak: 2, Best: 2)");
console.log("--------------------------------------------------------");
console.log(".env.local updated.");
