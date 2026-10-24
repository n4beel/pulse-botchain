import { describe, expect, it } from "vitest";
import { describeError, isUserRejection } from "../errors";
import { BaseError, ContractFunctionRevertedError } from "viem";

describe("describeError", () => {
  it("translates user rejection to quiet Cancelled sentence", () => {
    const userErr = new Error("User rejected the request");
    expect(isUserRejection(userErr)).toBe(true);
    expect(describeError(userErr)).toBe("Cancelled.");

    const metamaskCode = { code: 4001, message: "User denied transaction signature" };
    expect(isUserRejection(metamaskCode)).toBe(true);
    expect(describeError(metamaskCode)).toBe("Cancelled.");
  });

  it("translates AlreadyCheckedIn revert into informative countdown sentence", () => {
    const error = new BaseError("Execution reverted", {
      cause: new ContractFunctionRevertedError({
        abi: [],
        data: "0x",
        functionName: "checkIn",
        message: "reverted",
      }),
    });

    // Mock revert data on the error
    (error as any).data = {
      errorName: "AlreadyCheckedIn",
      args: [20370n, 1760000000n],
    };

    const sentence = describeError(error);
    expect(sentence).toContain("You're done for today. Next check-in opens at");
  });

  it("falls back to network refused message for unknown errors", () => {
    const err = new Error("Out of gas");
    const sentence = describeError(err);
    expect(sentence).toContain("The network refused this check-in. Out of gas");
  });
});
