import { describe, expect, it } from "vitest";
import { encodeFunctionData, parseAbi } from "viem";
import { inspectWalletRequest } from "../packages/adapters/wallet";
const token = "0x1111111111111111111111111111111111111111";
const spender = "0x2222222222222222222222222222222222222222";
const data = encodeFunctionData({
  abi: parseAbi(["function approve(address,uint256)"]),
  functionName: "approve",
  args: [spender, (1n << 256n) - 1n],
});
describe("passive wallet request decoding", () => {
  it("decodes unlimited approval without retaining the account or raw calldata", () => {
    const r = inspectWalletRequest(
      {
        method: "eth_sendTransaction",
        params: [{ to: token, data, from: spender }],
      },
      "0x1237",
    );
    expect(r).toMatchObject({
      kind: "approval",
      chainId: "4663",
      spender,
      unlimited: true,
    });
    expect(r).not.toHaveProperty("from");
    expect(r).not.toHaveProperty("data");
  });
  it("does not label payable or trailing-calldata calls as token approvals", () => {
    for (const tx of [
      { to: token, data, value: "0x1" },
      { to: token, data: data + "00" },
    ])
      expect(
        inspectWalletRequest({ method: "eth_sendTransaction", params: [tx] })
          ?.kind,
      ).toBe("unknown");
  });
  it("uses typed domain network rather than page/provider network", () => {
    expect(
      inspectWalletRequest(
        {
          method: "eth_signTypedData_v4",
          params: [
            spender,
            JSON.stringify({
              domain: { chainId: 1, verifyingContract: token },
            }),
          ],
        },
        "0x1237",
      ),
    ).toMatchObject({ kind: "typed-data", chainId: "1", target: token });
  });
  it("ignores non-allowlisted requests and oversized or malformed input", () => {
    expect(
      inspectWalletRequest({
        method: "personal_sign",
        params: ["private text"],
      }),
    ).toBeNull();
    expect(
      inspectWalletRequest({
        method: "eth_signTypedData_v4",
        params: [spender, "{"],
      }),
    ).toBeNull();
    expect(
      inspectWalletRequest({
        method: "eth_sendTransaction",
        params: [{ data: "0".repeat(40000) }],
      }),
    ).toBeNull();
  });
  it("fingerprints amount changes independently", () => {
    const request = {
      method: "eth_sendTransaction",
      params: [{ to: token, data }],
    };
    expect(inspectWalletRequest(request)?.hash).not.toBe(
      inspectWalletRequest({
        ...request,
        params: [{ to: token, data, value: "0x1" }],
      })?.hash,
    );
  });
});
