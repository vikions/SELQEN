import { z } from "zod";
import Decimal from "decimal.js";
import {
  createPublicClient,
  http,
  parseAbi,
  formatUnits,
  getAddress,
} from "viem";
import { MAINNET, sameAddress, type Snapshot } from "../engine/types";
import { readEquityOracle, readSettlementOracle } from "./oracle";
const API = "https://api.robinhood.com/rhj";
export const RPC = "https://rpc.mainnet.chain.robinhood.com";
const decimal = z.string().regex(/^\d+(\.\d+)?$/);
const deployment = z.object({
  chainId: z.number().int(),
  contractAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});
export const assetSchema = z.object({
  id: z.string(),
  tokenSymbol: z.string(),
  tokenName: z.string(),
  deployments: z.array(deployment),
  currentMultiplier: decimal,
  pendingMultiplier: z.string().optional(),
  pendingMultiplierEffectiveTime: z.string().optional(),
  status: z.string().optional(),
  tradingCapabilities: z.unknown().optional(),
});
const priceSchema = z.object({
  tokenSymbol: z.string(),
  deployments: z.array(deployment),
  bid: decimal,
  ask: decimal,
  currency: z.literal("USD"),
  isTradingHalt: z.boolean(),
  generatedAt: z.string(),
});
const abi = parseAbi([
  "function uiMultiplier() view returns (uint256)",
  "function oraclePaused() view returns (bool)",
  "function newUIMultiplier() view returns (uint256)",
  "function effectiveAt() view returns (uint256)",
]);
async function json(url: string, signal?: AbortSignal) {
  const r = await fetch(url, {
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(12_000)])
      : AbortSignal.timeout(12_000),
    credentials: "omit",
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Source returned HTTP ${r.status}`);
  return r.json();
}
export function unavailable(
  address: string,
  chainId: number,
  error: string,
): Snapshot {
  return {
    mode: "live",
    chainId,
    address,
    canonical: null,
    registryAt: 0,
    fetchedAt: Date.now(),
    halt: null,
    oraclePaused: null,
    errors: [error],
  };
}
export async function checkAsset(
  input: string,
  chainId = MAINNET,
  signal?: AbortSignal,
  localProxy = false,
): Promise<Snapshot> {
  const api = localProxy ? "/rhj" : API;
  let address: string;
  try {
    address = getAddress(input.toLowerCase());
  } catch {
    return unavailable(
      input,
      chainId,
      "Enter a 42-character EVM contract address.",
    );
  }
  if (chainId !== MAINNET)
    return unavailable(
      address,
      chainId,
      "Only mainnet 4663 is supported by this live registry adapter.",
    );
  let entries: z.infer<typeof assetSchema>[];
  try {
    const data = z
      .object({ assets: z.array(assetSchema) })
      .parse(await json(`${api}/assets`, signal));
    entries = data.assets;
  } catch (error) {
    const reason =
      error instanceof z.ZodError
        ? "Registry response does not match the supported schema."
        : error instanceof Error &&
            error.message.startsWith("Source returned HTTP")
          ? error.message
          : "Network request failed or timed out.";
    return unavailable(
      address,
      chainId,
      `Official registry unavailable. ${reason} Retry the check.`,
    );
  }
  const at = Date.now();
  const candidates = entries.filter((a) =>
    a.deployments.some(
      (d) => d.chainId === chainId && sameAddress(d.contractAddress, address),
    ),
  );
  if (candidates.length > 1)
    return unavailable(address, chainId, "Registry identity is ambiguous.");
  const asset = candidates[0];
  const snapshot: Snapshot = {
    mode: "live",
    chainId,
    address,
    canonical: !!asset,
    registryAt: at,
    fetchedAt: at,
    halt: null,
    oraclePaused: null,
    errors: [],
  };
  if (!asset) return snapshot;
  Object.assign(snapshot, {
    symbol: asset.tokenSymbol,
    name: asset.tokenName,
    assetStatus: asset.status,
    multiplier: asset.currentMultiplier,
    pendingMultiplier: asset.pendingMultiplier || undefined,
    effectiveAt: asset.pendingMultiplierEffectiveTime
      ? Date.parse(asset.pendingMultiplierEffectiveTime)
      : undefined,
    tradingCapabilities: asset.tradingCapabilities,
  });
  const client = createPublicClient({
    transport: http(localProxy ? "/rpc" : RPC, {
      timeout: 12_000,
      retryCount: 0,
    }),
  });
  const [prices, token, actions] = await Promise.allSettled([
    json(`${api}/prices/${encodeURIComponent(asset.tokenSymbol)}`, signal),
    (async () => {
      const network = await client.getChainId();
      if (network !== chainId) throw new Error("RPC chain mismatch");
      const blockNumber = await client.getBlockNumber();
      // An unavailable oracle must not discard independently obtained token state.
      const oracle = readEquityOracle(client, address, chainId, blockNumber)
        .then((value) => ({ value, failed: false }))
        .catch(() => ({ value: undefined, failed: true }));
      const settlementOracle = readSettlementOracle(
        client,
        chainId,
        blockNumber,
      )
        .then((value) => ({ value, failed: false }))
        .catch(() => ({ value: undefined, failed: true }));
      const contract = { address: address as `0x${string}`, abi, blockNumber };
      const [multiplier, paused, pending, effective] = await Promise.all([
        client.readContract({ ...contract, functionName: "uiMultiplier" }),
        client.readContract({ ...contract, functionName: "oraclePaused" }),
        client.readContract({ ...contract, functionName: "newUIMultiplier" }),
        client.readContract({ ...contract, functionName: "effectiveAt" }),
      ]);
      return {
        blockNumber,
        multiplier,
        paused,
        pending,
        effective,
        oracle: await oracle,
        settlementOracle: await settlementOracle,
      };
    })(),
    json(`${api}/corporate-actions`, signal),
  ]);
  if (prices.status === "fulfilled") {
    try {
      const quotes = z
        .object({ quotes: z.array(priceSchema) })
        .parse(prices.value).quotes;
      const q = quotes.find((q) =>
        q.deployments.some(
          (d) =>
            d.chainId === chainId && sameAddress(d.contractAddress, address),
        ),
      );
      if (!q) throw new Error();
      Object.assign(snapshot, {
        bid: q.bid,
        ask: q.ask,
        quoteAt: Date.parse(q.generatedAt),
        halt: q.isTradingHalt,
      });
    } catch {
      snapshot.errors.push(
        "Quote response cannot be reconciled with the canonical token.",
      );
    }
  } else snapshot.errors.push("Underlying price endpoint unavailable.");
  if (token.status === "fulfilled") {
    const t = token.value;
    snapshot.onchainMultiplier = formatUnits(t.multiplier, 18);
    snapshot.oraclePaused = t.paused;
    snapshot.blockNumber = t.blockNumber.toString();
    snapshot.oracle = t.oracle.value;
    snapshot.settlementOracle = t.settlementOracle.value;
    if (t.settlementOracle.failed)
      snapshot.errors.push(
        "USDG Chainlink reference unavailable; quote comparison will disclose the parity assumption.",
      );
    if (t.oracle.failed)
      snapshot.errors.push(
        "Verified AAPL Chainlink feed could not be read or validated.",
      );
    const effective = Number(t.effective) * 1000;
    if (effective > at && t.pending !== t.multiplier) {
      const pending = formatUnits(t.pending, 18);
      if (
        snapshot.pendingMultiplier &&
        !new Decimal(snapshot.pendingMultiplier).eq(pending)
      ) {
        snapshot.errors.push("Pending multiplier sources disagree.");
        snapshot.oraclePaused = null;
      }
      snapshot.pendingMultiplier = pending;
      snapshot.effectiveAt = effective;
    }
  } else
    snapshot.errors.push(
      "Token contract state could not be read from the official RPC.",
    );
  if (actions.status === "fulfilled") {
    try {
      const rows = z
        .object({
          corpActions: z.array(
            z.object({
              type: z.string(),
              status: z.string(),
              deployments: z.array(deployment),
            }),
          ),
        })
        .parse(actions.value).corpActions;
      snapshot.corporateActions = rows
        .filter(
          (a) =>
            a.deployments.some(
              (d) =>
                d.chainId === chainId &&
                sameAddress(d.contractAddress, address),
            ) && a.status === "CORPORATE_ACTION_STATUS_IN_PROGRESS",
        )
        .map((a) =>
          a.type
            .replace("CORPORATE_ACTION_TYPE_", "")
            .replaceAll("_", " ")
            .toLowerCase(),
        );
    } catch {
      snapshot.errors.push("Corporate-action history schema is unavailable.");
    }
  } else
    snapshot.errors.push(
      "Corporate-action history unavailable; scheduled multiplier checks use token metadata.",
    );
  if (snapshot.corporateActions?.length)
    snapshot.errors.push(
      `Issuer reports in-progress actions: ${snapshot.corporateActions.join(", ")}. A scheduled multiplier time may not yet be available.`,
    );
  snapshot.fetchedAt = Date.now();
  return snapshot;
}
