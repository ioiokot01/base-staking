const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const Factory = await hre.ethers.getContractFactory("StakingRewards");
  const staking = await Factory.deploy();
  await staking.waitForDeployment();

  const address = await staking.getAddress();
  console.log("StakingRewards deployed to:", address);
  console.log("Explorer:", `https://sepolia.basescan.org/address/${address}`);
  console.log("\nUpdate frontend/app.js -> CONTRACT_ADDRESS with this address.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
