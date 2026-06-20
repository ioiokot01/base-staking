const hre = require("hardhat");

// Deployed StakingRewards on Base Sepolia.
const ADDRESS = "0xC27C2631DBf0817b9B1EF14459eBA07EABbBBc53";

async function main() {
  const staking = await hre.ethers.getContractAt("StakingRewards", ADDRESS);
  const [account] = await hre.ethers.getSigners();

  console.log("StakingRewards:", ADDRESS);
  console.log("Reward token:", await staking.name(), `(${await staking.symbol()})`);
  console.log("Total staked:", hre.ethers.formatEther(await staking.totalStaked()), "ETH");

  if (account) {
    console.log("\nFor", account.address);
    console.log("  staked:", hre.ethers.formatEther(await staking.staked(account.address)), "ETH");
    console.log("  earned:", hre.ethers.formatEther(await staking.earned(account.address)), "BSR");
    console.log("  BSR balance:", hre.ethers.formatEther(await staking.balanceOf(account.address)));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
