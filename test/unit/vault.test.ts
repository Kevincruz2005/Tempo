import { describe, expect, it } from "vitest";
import * as fs from "node:fs";

describe("TempoAuctionVault Contract Artifact & Interface", () => {
  it("compiles with exact ABI and valid EVM bytecode", () => {
    expect(fs.existsSync("contracts/TempoAuctionVault.json")).toBe(true);
    const artifact = JSON.parse(fs.readFileSync("contracts/TempoAuctionVault.json", "utf8"));
    
    expect(artifact.abi).toBeDefined();
    expect(artifact.bytecode).toBeDefined();
    expect(artifact.bytecode.length).toBeGreaterThan(1000);
  });

  it("contains all core ERC-4626 and auction allocation functions in ABI", () => {
    const artifact = JSON.parse(fs.readFileSync("contracts/TempoAuctionVault.json", "utf8"));
    const functionNames = artifact.abi
      .filter((item: any) => item.type === "function")
      .map((item: any) => item.name);

    expect(functionNames).toContain("deposit");
    expect(functionNames).toContain("withdraw");
    expect(functionNames).toContain("totalAssets");
    expect(functionNames).toContain("convertToShares");
    expect(functionNames).toContain("convertToAssets");
    expect(functionNames).toContain("allocateAuctionCollateral");
    expect(functionNames).toContain("settleAuctionReturns");
    expect(functionNames).toContain("setGenesisOperator");
    expect(functionNames).toContain("setVenueWhitelist");
  });

  it("has valid deployment manifest with verified address on Shannon testnet", () => {
    expect(fs.existsSync("contracts/deployment-shannon.json")).toBe(true);
    const deployment = JSON.parse(fs.readFileSync("contracts/deployment-shannon.json", "utf8"));

    expect(deployment.contractName).toBe("TempoAuctionVault");
    expect(deployment.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(deployment.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    expect(deployment.network).toContain("50312");
  });
});
