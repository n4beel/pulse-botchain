import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  BaseError,
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  defineChain,
  http,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { pulseAbi } from "@/lib/botchain/abi";
import { DAY, nextMidnight, utcDay } from "@/lib/pulse";

const PORT = 8601;
const RPC = `http://127.0.0.1:${PORT}`;
const CHAIN_ID = 968 as const;
const KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const local = defineChain({
  id: CHAIN_ID,
  name: "anvil",
  nativeCurrency: { name: "Test BOT", symbol: "tBOT", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

let node: ChildProcess;
let publicClient: PublicClient;
let wallet: WalletClient;
let address: Address;
let deployBlock: bigint;
const account = privateKeyToAccount(KEY);

function revertDetails(err: unknown): { errorName?: string; args?: readonly unknown[] } | undefined {
  if (!(err instanceof BaseError)) return undefined;
  const found = err.walk(
    (e) =>
      typeof e === "object" &&
      e !== null &&
      "data" in e &&
      Boolean((e as { data?: { errorName?: string } }).data?.errorName),
  ) as { data?: { errorName?: string; args?: readonly unknown[] } } | null;
  return found?.data;
}

beforeAll(async () => {
  node = spawn("anvil", ["--port", String(PORT), "--chain-id", String(CHAIN_ID), "--silent"], {
    stdio: ["ignore", "ignore", "inherit"],
  });

  publicClient = createPublicClient({ chain: local, transport: http() }) as PublicClient;
  wallet = createWalletClient({ account, chain: local, transport: http() });

  for (let i = 0; ; i++) {
    try {
      await publicClient.getBlockNumber();
      break;
    } catch {
      if (i > 100) throw new Error(`anvil never answered on ${RPC}`);
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  const artifact = JSON.parse(
    readFileSync(
      new URL("../../contracts/out/Pulse.sol/Pulse.json", import.meta.url),
      "utf8",
    ),
  ) as { bytecode: { object: Hex } };

  const hash = await wallet.deployContract({
    abi: pulseAbi,
    bytecode: artifact.bytecode.object,
    account,
    chain: local,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  expect(receipt.status).toBe("success");
  address = receipt.contractAddress!;
  deployBlock = receipt.blockNumber;

  process.env.NEXT_PUBLIC_BOHR_RPC = RPC;
  process.env.NEXT_PUBLIC_BOTCHAIN_NETWORK = "testnet";
  process.env.NEXT_PUBLIC_CONTRACT_968 = address;
  process.env.NEXT_PUBLIC_DEPLOY_BLOCK_968 = String(deployBlock > 1n ? deployBlock - 1n : 1n);
}, 60_000);

afterAll(() => {
  node?.kill("SIGTERM");
});

describe("Pulse on live local EVM", () => {
  it("deploys", () => {
    expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("constant DAY matches between contract and TypeScript lib", async () => {
    const onChainDay = await publicClient.readContract({
      address,
      abi: pulseAbi,
      functionName: "DAY",
    });
    expect(Number(onChainDay)).toBe(DAY);
  });

  it("today() view agrees with client utcDay() calculation", async () => {
    const block = await publicClient.getBlock();
    const contractToday = await publicClient.readContract({
      address,
      abi: pulseAbi,
      functionName: "today",
    });
    const clientDay = utcDay(Number(block.timestamp));
    expect(contractToday).toBe(clientDay);
  });

  it("checkIn() updates status and emits CheckedIn log", async () => {
    const hash = await wallet.writeContract({
      address,
      abi: pulseAbi,
      functionName: "checkIn",
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    expect(receipt.status).toBe("success");
    expect(receipt.gasUsed).toBeLessThan(110_000n);

    const status = await publicClient.readContract({
      address,
      abi: pulseAbi,
      functionName: "statusOf",
      args: [account.address],
    });

    expect(status.current).toBe(1);
    expect(status.best).toBe(1);
    expect(status.total).toBe(1);
    expect(status.checkedInToday).toBe(true);
    expect(status.streakAlive).toBe(true);
  });

  it("second checkIn on the same day reverts AlreadyCheckedIn(today, nextMidnight)", async () => {
    const block = await publicClient.getBlock();
    const currentDay = utcDay(Number(block.timestamp));
    const nextMidnightTime = nextMidnight(Number(block.timestamp));

    let threw = false;
    try {
      await wallet.writeContract({
        address,
        abi: pulseAbi,
        functionName: "checkIn",
      });
    } catch (err: unknown) {
      threw = true;
      const details = revertDetails(err);
      expect(details?.errorName).toBe("AlreadyCheckedIn");
      expect(details?.args?.[0]).toBe(currentDay);
      expect(details?.args?.[1]).toBe(BigInt(nextMidnightTime));
    }
    expect(threw).toBe(true);
  });

  it("evm_increaseTime(86400) extends streak to 2", async () => {
    await publicClient.request({
      method: "evm_increaseTime" as any,
      params: [86400] as any,
    });
    await publicClient.request({ method: "evm_mine" as any, params: [] as any });

    const hash = await wallet.writeContract({
      address,
      abi: pulseAbi,
      functionName: "checkIn",
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    expect(receipt.status).toBe("success");

    const status = await publicClient.readContract({
      address,
      abi: pulseAbi,
      functionName: "statusOf",
      args: [account.address],
    });

    expect(status.current).toBe(2);
    expect(status.best).toBe(2);
    expect(status.total).toBe(2);
    expect(status.checkedInToday).toBe(true);
  });

  it("skipping two days breaks streak, resets current to 1, keeps best 2, emits brokenFrom", async () => {
    // Warp 2 days (172800 seconds)
    await publicClient.request({
      method: "evm_increaseTime" as any,
      params: [172800] as any,
    });
    await publicClient.request({ method: "evm_mine" as any, params: [] as any });

    const hash = await wallet.writeContract({
      address,
      abi: pulseAbi,
      functionName: "checkIn",
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    expect(receipt.status).toBe("success");

    // Check decoded log
    const log = receipt.logs[0];
    const decoded = decodeEventLog({
      abi: pulseAbi,
      data: log.data,
      topics: log.topics,
    });
    expect(decoded.eventName).toBe("CheckedIn");
    expect((decoded.args as any).brokenFrom).toBe(2);
    expect((decoded.args as any).streak).toBe(1);
    expect((decoded.args as any).best).toBe(2);

    const status = await publicClient.readContract({
      address,
      abi: pulseAbi,
      functionName: "statusOf",
      args: [account.address],
    });

    expect(status.current).toBe(1);
    expect(status.best).toBe(2);
    expect(status.total).toBe(3);
    expect(status.checkedInToday).toBe(true);
  });
});
