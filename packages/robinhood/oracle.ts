import { formatUnits, parseAbi, type PublicClient } from "viem";
import { MAINNET, sameAddress, type Snapshot } from "../engine/types";
import catalog from "./feeds.json";

// Official directory joined to the official registry; provenance in feeds.json.
// A token symbol alone never selects a price feed at runtime.
// https://reference-data-directory.vercel.app/feeds-robinhood-mainnet.json
export const AAPL_FEED = "0x6B22A786bAa607d76728168703a39Ea9C99f2cD0" as const;
export const USDG_FEED = "0x61B7e5650328764B076A108EFF5fa7282a1B9aD2" as const;
export const feedAbi = parseAbi([
  "function decimals() view returns (uint8)",
  "function description() view returns (string)",
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
]);

export function normalizeRound(
  round: readonly [bigint, bigint, bigint, bigint, bigint],
  decimals: number,
  now = Date.now(),
): Omit<NonNullable<Snapshot["oracle"]>, "address"> {
  const [id, answer, started, updated, answered] = round;
  const updatedAt = Number(updated) * 1000;
  if (
    decimals !== 8 ||
    id <= 0n ||
    answer <= 0n ||
    answered < id ||
    started <= 0n ||
    updated < started ||
    !Number.isSafeInteger(updatedAt) ||
    updatedAt > now ||
    updatedAt <= 0
  )
    throw new Error("Invalid Chainlink round");
  return {
    value: formatUnits(answer, decimals),
    updatedAt,
    maxAgeMs: 86_400_000,
  };
}

export async function readEquityOracle(
  client: PublicClient,
  address: string,
  chainId: number,
  blockNumber: bigint,
) {
  const feed = catalog.feeds.find(
    (entry) =>
      chainId === MAINNET &&
      entry.chainId === chainId &&
      sameAddress(address, entry.tokenAddress),
  );
  if (!feed) return undefined;
  return readFeed(
    client,
    feed.feedAddress as `0x${string}`,
    feed.description,
    blockNumber,
  );
}
export async function readSettlementOracle(
  client: PublicClient,
  chainId: number,
  blockNumber: bigint,
) {
  if (chainId !== MAINNET) return undefined;
  return readFeed(client, USDG_FEED, "USDG / USD", blockNumber);
}
async function readFeed(
  client: PublicClient,
  address: `0x${string}`,
  expectedDescription: string,
  blockNumber: bigint,
) {
  const contract = { address, abi: feedAbi, blockNumber };
  const [decimals, description, round] = await Promise.all([
    client.readContract({ ...contract, functionName: "decimals" }),
    client.readContract({ ...contract, functionName: "description" }),
    client.readContract({ ...contract, functionName: "latestRoundData" }),
  ]);
  if (description !== expectedDescription)
    throw new Error("Feed description mismatch");
  return { ...normalizeRound(round, decimals), address };
}
