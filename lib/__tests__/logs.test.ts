import { describe, expect, it } from "vitest";
import { getLogsAtBlock, getLogsChunked } from "../logs";
import type { AbiEvent, Address, Log } from "viem";

describe("logs utilities", () => {
  const dummyEvent: AbiEvent = {
    type: "event",
    name: "CheckedIn",
    inputs: [],
    anonymous: false,
  };
  const dummyAddress = "0x1111111111111111111111111111111111111111" as Address;

  it("walks chunked ranges and aggregates logs", () => {
    return new Promise<void>(async (resolve) => {
      const calls: { from: bigint; to: bigint }[] = [];
      const fakeClient = {
        getBlockNumber: async () => 50_000n,
        getLogs: async (args: any) => {
          calls.push({ from: args.fromBlock, to: args.toBlock });
          return [{ blockNumber: args.fromBlock, logIndex: 0 }] as unknown as Log[];
        },
      };

      const result = await getLogsChunked({
        client: fakeClient,
        address: dummyAddress,
        event: dummyEvent,
        fromBlock: 10_000n,
        toBlock: 50_000n,
        chunk: 20_000n,
      });

      expect(result.complete).toBe(true);
      expect(result.logs.length).toBe(3); // 10k-29999, 30k-49999, 50k-50k
      expect(calls.length).toBe(3);
      expect(calls[0]).toEqual({ from: 10_000n, to: 29_999n });
      expect(calls[1]).toEqual({ from: 30_000n, to: 49_999n });
      expect(calls[2]).toEqual({ from: 50_000n, to: 50_000n });
      resolve();
    });
  });

  it("halves chunk on range error and recovers", () => {
    return new Promise<void>(async (resolve) => {
      let failedOnce = false;
      const fakeClient = {
        getBlockNumber: async () => 2000n,
        getLogs: async (args: any) => {
          if (!failedOnce && args.toBlock - args.fromBlock > 600n) {
            failedOnce = true;
            throw new Error("Log response size exceeded");
          }
          return [] as Log[];
        },
      };

      const result = await getLogsChunked({
        client: fakeClient,
        address: dummyAddress,
        event: dummyEvent,
        fromBlock: 0n,
        toBlock: 2000n,
        chunk: 1000n,
      });

      expect(failedOnce).toBe(true);
      expect(result.complete).toBe(true);
      resolve();
    });
  });

  it("fetches single block via getLogsAtBlock", async () => {
    let capturedBlock: bigint | undefined;
    const fakeClient = {
      getLogs: async (args: any) => {
        capturedBlock = args.fromBlock;
        return [{ blockNumber: args.fromBlock }] as unknown as Log[];
      },
    };

    const logs = await getLogsAtBlock(fakeClient, dummyAddress, dummyEvent, undefined, 12345n);
    expect(capturedBlock).toBe(12345n);
    expect(logs.length).toBe(1);
  });
});
