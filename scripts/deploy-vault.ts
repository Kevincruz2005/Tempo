import { createPublicClient, createWalletClient, http, encodeDeployData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import * as fs from "node:fs";

async function main() {
  const artifact = JSON.parse(fs.readFileSync("contracts/TempoAuctionVault.json", "utf8"));
  
  const privateKey = (process.env.TEMPO_KEY_MAKER || "0xbf24e5329c0d4f27e17e655b302f304547c1e58bab505e325d5010a6c348e461") as `0x${string}`;
  const account = privateKeyToAccount(privateKey);
  
  const rpcUrl = process.env.TEMPO_RPC_URL || "https://api.infra.testnet.somnia.network";
  
  console.log("Deployer address:", account.address);
  console.log("Using RPC:", rpcUrl);

  const publicClient = createPublicClient({
    chain: somniaShannon,
    transport: http(rpcUrl)
  });

  const walletClient = createWalletClient({
    account,
    chain: somniaShannon,
    transport: http(rpcUrl)
  });

  const collateralAddress = "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E"; // Shannon tUSDC
  const operatorAddress = account.address; // GENESIS operator

  console.log("Constructor args:");
  console.log("  _asset:", collateralAddress);
  console.log("  _genesisOperator:", operatorAddress);

  const deployData = encodeDeployData({
    abi: artifact.abi,
    bytecode: `0x${artifact.bytecode}`,
    args: [collateralAddress, operatorAddress]
  });

  console.log("Deploying TempoAuctionVault to Somnia Shannon (50312)...");
  const hash = await walletClient.sendTransaction({
    data: deployData
  });

  console.log("Transaction submitted! Hash:", hash);
  console.log("Waiting for receipt...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("Transaction mined! Status:", receipt.status);
  console.log("Deployed TempoAuctionVault Address:", receipt.contractAddress);
  console.log("Block Number:", receipt.blockNumber);
  console.log(`Explorer Link: https://shannon-explorer.somnia.network/address/${receipt.contractAddress}`);

  const deploymentInfo = {
    contractName: "TempoAuctionVault",
    address: receipt.contractAddress,
    deployer: account.address,
    transactionHash: hash,
    blockNumber: receipt.blockNumber.toString(),
    network: "Somnia Shannon Testnet (50312)",
    collateral: collateralAddress,
    genesisOperator: operatorAddress,
    explorerUrl: `https://shannon-explorer.somnia.network/address/${receipt.contractAddress}`,
    deployedAt: new Date().toISOString()
  };

  fs.writeFileSync("contracts/deployment-shannon.json", JSON.stringify(deploymentInfo, null, 2));
  console.log("Saved contracts/deployment-shannon.json");
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
