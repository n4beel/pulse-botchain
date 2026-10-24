import { BaseError, ContractFunctionRevertedError } from "viem";
import { formatCountdown } from "./pulse";

export interface RevertDetails {
  errorName?: string;
  args?: readonly unknown[];
}

/**
 * Traverses an error to extract the custom revert error name and arguments.
 */
export function extractRevert(err: unknown): RevertDetails | undefined {
  if (typeof err !== "object" || err === null) return undefined;

  // Direct property check
  if ("data" in err && (err as any).data && typeof (err as any).data === "object" && (err as any).data.errorName) {
    return {
      errorName: (err as any).data.errorName,
      args: (err as any).data.args,
    };
  }
  if ("errorName" in err && typeof (err as any).errorName === "string") {
    return {
      errorName: (err as any).errorName,
      args: (err as any).args,
    };
  }

  // If it's a viem BaseError, use walk
  if (err instanceof BaseError) {
    const reverted = err.walk((e) => {
      if (e instanceof ContractFunctionRevertedError) return true;
      if (typeof e === "object" && e !== null && "data" in e && Boolean((e as any).data?.errorName)) return true;
      if (typeof e === "object" && e !== null && "errorName" in e && Boolean((e as any).errorName)) return true;
      return false;
    });

    if (reverted) {
      const errorObj = reverted as any;
      if (errorObj.data?.errorName) {
        return {
          errorName: errorObj.data.errorName,
          args: errorObj.data.args,
        };
      }
      if (errorObj.errorName) {
        return {
          errorName: errorObj.errorName,
          args: errorObj.args,
        };
      }
    }
  }

  return undefined;
}

/**
 * Checks whether an error represents the user rejecting the prompt in their wallet.
 */
export function isUserRejection(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("User rejected") ||
    msg.includes("User denied") ||
    msg.includes("user rejected") ||
    msg.includes("ACTION_REJECTED") ||
    (typeof err === "object" && err !== null && "code" in err && (err as { code: number }).code === 4001)
  );
}

/**
 * Translates an unknown error into a human-friendly sentence in Pulse's voice.
 */
export function describeError(err: unknown): string {
  if (isUserRejection(err)) {
    return "Cancelled.";
  }

  const details = extractRevert(err);
  if (details?.errorName === "AlreadyCheckedIn") {
    const nextAt = Array.isArray(details.args) && details.args[1] ? Number(details.args[1]) : 0;
    if (nextAt > 0) {
      const timeStr = new Date(nextAt * 1000).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const nowSec = Math.floor(Date.now() / 1000);
      const countdown = formatCountdown(Math.max(0, nextAt - nowSec));
      return `You're done for today. Next check-in opens at ${timeStr} (${countdown}).`;
    }
    return "You're done for today.";
  }

  if (err instanceof Error) {
    const shortReason = err.message.slice(0, 120).replace(/\n/g, " ");
    return `The network refused this check-in. ${shortReason}`;
  }

  return "The network refused this check-in.";
}
