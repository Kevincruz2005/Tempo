/** Browser-wallet helpers. No private key ever crosses this boundary. */
import { createWalletClient, custom, type Address, type Chain, type WalletClient } from "viem";
import { somniaMainnet, somniaShannon } from "@somnia-chain/markets-sdk/chains";
import type { Network } from "./config.js";

export interface Eip1193Provider {
  request(args: { method: string; params?: readonly unknown[] }): Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
}

export interface Eip6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface Eip6963ProviderDetail {
  info: Eip6963ProviderInfo;
  provider: Eip1193Provider;
}

export interface WalletTradeSummary {
  marketSymbol: string;
  side: "UP" | "DOWN";
  size: number;
  limitPrice: number;
  expireTimestampNs: bigint;
  secondsLeft: number;
  worstCaseCost: number;
  chainId: number;
  destinations: readonly Address[];
  nativeValue: bigint;
  collateralBalance: number;
}

export const expectedChainId = (network: Network): number => network === "testnet" ? 50312 : 5031;

export const expectedChain = (network: Network): Chain => network === "testnet" ? somniaShannon : somniaMainnet;

export function parseChainId(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^0x[0-9a-f]+$/i.test(value)) {
    const parsed = Number.parseInt(value.slice(2), 16);
    return Number.isSafeInteger(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function normalizeAddress(value: unknown): Address | undefined {
  return typeof value === "string" && /^0x[0-9a-f]{40}$/i.test(value) ? value as Address : undefined;
}

export function parseTransactionHash(value: unknown): `0x${string}` | undefined {
  return typeof value === "string" && /^0x[0-9a-f]{64}$/i.test(value) ? value as `0x${string}` : undefined;
}

export function parseReceiptStatus(value: unknown): "success" | "reverted" | undefined {
  if (!value || typeof value !== "object") return undefined;
  const status = (value as { status?: unknown }).status;
  if (status === "0x1" || status === 1 || status === "success") return "success";
  if (status === "0x0" || status === 0 || status === "reverted") return "reverted";
  return undefined;
}

export function assertAllowedDestinations(calls: readonly { to?: unknown }[], allowlist: readonly string[]): Address[] {
  const allowed = new Set(allowlist.map((address) => normalizeAddress(address)?.toLowerCase()).filter(Boolean));
  return calls.map((call) => {
    const destination = normalizeAddress(call.to);
    if (!destination || !allowed.has(destination.toLowerCase())) throw new Error("wallet transaction destination is not allowlisted");
    return destination;
  });
}

export function truncateAddress(value: string | undefined, visible = 6): string {
  if (!value || !/^0x[0-9a-f]{40}$/i.test(value)) return "UNAVAILABLE";
  return `${value.slice(0, visible + 2)}…${value.slice(-4)}`;
}

export async function requestAccounts(provider: Eip1193Provider): Promise<Address[]> {
  const result = await provider.request({ method: "eth_requestAccounts" });
  if (!Array.isArray(result)) throw new Error("wallet returned malformed accounts");
  const accounts = result.map(normalizeAddress);
  if (accounts.some((address) => !address)) throw new Error("wallet returned malformed account");
  if (accounts.length === 0) throw new Error("wallet returned no accounts");
  return accounts as Address[];
}

export async function readWalletChainId(provider: Eip1193Provider): Promise<number> {
  const result = await provider.request({ method: "eth_chainId" });
  const chainId = parseChainId(result);
  if (chainId === undefined) throw new Error("wallet returned malformed chain id");
  return chainId;
}

export function createInjectedWalletClient(provider: Eip1193Provider, network: Network): WalletClient {
  return createWalletClient({ chain: expectedChain(network), transport: custom(provider) });
}

export function buildWalletTradeSummary(input: WalletTradeSummary): Readonly<WalletTradeSummary> {
  if (!input.marketSymbol || !Number.isFinite(input.size) || input.size <= 0) throw new Error("wallet trade size is invalid");
  if (!Number.isFinite(input.limitPrice) || input.limitPrice <= 0 || input.limitPrice >= 1) throw new Error("wallet trade price is invalid");
  if (!Number.isFinite(input.secondsLeft) || input.secondsLeft <= 0) throw new Error("wallet market is expired");
  if (input.chainId <= 0 || !Number.isSafeInteger(input.chainId)) throw new Error("wallet chain id is invalid");
  if (!Number.isFinite(input.collateralBalance) || input.collateralBalance < input.worstCaseCost) throw new Error("wallet collateral balance is insufficient");
  assertAllowedDestinations(input.destinations.map((to) => ({ to })), input.destinations);
  if (input.nativeValue < 0n) throw new Error("wallet native value is invalid");
  return Object.freeze({ ...input });
}
