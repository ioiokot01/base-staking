const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("StakingRewards", function () {
  const DAY = 24 * 60 * 60;

  async function deploy() {
    const [owner, alice, bob] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("StakingRewards");
    const staking = await Factory.deploy();
    await staking.waitForDeployment();
    return { staking, owner, alice, bob };
  }

  describe("Deployment", function () {
    it("sets reward token metadata", async function () {
      const { staking } = await deploy();
      expect(await staking.name()).to.equal("Base Stake Reward");
      expect(await staking.symbol()).to.equal("BSR");
      expect(await staking.totalStaked()).to.equal(0n);
    });
  });

  describe("Staking", function () {
    it("records a stake and emits Staked", async function () {
      const { staking, alice } = await deploy();
      const amount = ethers.parseEther("2");
      await expect(staking.connect(alice).stake({ value: amount }))
        .to.emit(staking, "Staked")
        .withArgs(alice.address, amount);

      expect(await staking.staked(alice.address)).to.equal(amount);
      expect(await staking.totalStaked()).to.equal(amount);
    });

    it("locks the ETH in the contract", async function () {
      const { staking, alice } = await deploy();
      await expect(
        staking.connect(alice).stake({ value: ethers.parseEther("1") })
      ).to.changeEtherBalance(staking, ethers.parseEther("1"));
    });

    it("rejects a zero stake", async function () {
      const { staking, alice } = await deploy();
      await expect(
        staking.connect(alice).stake({ value: 0 })
      ).to.be.revertedWith("Stake must be > 0");
    });
  });

  describe("Reward accrual", function () {
    it("accrues ~1 token per ETH per day", async function () {
      const { staking, alice } = await deploy();
      await staking.connect(alice).stake({ value: ethers.parseEther("1") });

      await time.increase(DAY);
      const earned = await staking.earned(alice.address);
      // 1 ETH * 1 day => ~1 token. Allow a tiny drift for the extra second(s).
      expect(earned).to.be.closeTo(
        ethers.parseEther("1"),
        ethers.parseEther("0.001")
      );
    });

    it("scales rewards with the amount staked", async function () {
      const { staking, alice } = await deploy();
      await staking.connect(alice).stake({ value: ethers.parseEther("5") });
      await time.increase(DAY);
      const earned = await staking.earned(alice.address);
      expect(earned).to.be.closeTo(
        ethers.parseEther("5"),
        ethers.parseEther("0.01")
      );
    });

    it("keeps rewards independent per staker", async function () {
      const { staking, alice, bob } = await deploy();
      await staking.connect(alice).stake({ value: ethers.parseEther("1") });
      await staking.connect(bob).stake({ value: ethers.parseEther("3") });
      await time.increase(DAY);

      const a = await staking.earned(alice.address);
      const b = await staking.earned(bob.address);
      expect(b).to.be.gt(a);
    });

    it("settles accrued rewards across multiple stakes", async function () {
      const { staking, alice } = await deploy();
      await staking.connect(alice).stake({ value: ethers.parseEther("1") });
      await time.increase(DAY);
      // Second stake settles the first day's reward, then doubles the rate.
      await staking.connect(alice).stake({ value: ethers.parseEther("1") });
      await time.increase(DAY);

      // ~1 (day 1 at 1 ETH) + ~2 (day 2 at 2 ETH) = ~3 tokens.
      const earned = await staking.earned(alice.address);
      expect(earned).to.be.closeTo(
        ethers.parseEther("3"),
        ethers.parseEther("0.01")
      );
    });
  });

  describe("Claiming", function () {
    it("mints accrued rewards and resets them", async function () {
      const { staking, alice } = await deploy();
      await staking.connect(alice).stake({ value: ethers.parseEther("1") });
      await time.increase(DAY);

      await expect(staking.connect(alice).claim()).to.emit(staking, "Claimed");
      const bal = await staking.balanceOf(alice.address);
      expect(bal).to.be.closeTo(
        ethers.parseEther("1"),
        ethers.parseEther("0.01")
      );
      // After claiming, the settled reward is back to ~0.
      expect(await staking.earned(alice.address)).to.be.lt(
        ethers.parseEther("0.001")
      );
    });

    it("reverts when there is nothing to claim", async function () {
      const { staking, alice } = await deploy();
      await expect(staking.connect(alice).claim()).to.be.revertedWith(
        "No rewards"
      );
    });
  });

  describe("Unstaking", function () {
    it("returns ETH and keeps earned rewards", async function () {
      const { staking, alice } = await deploy();
      await staking.connect(alice).stake({ value: ethers.parseEther("2") });
      await time.increase(DAY);

      await expect(
        staking.connect(alice).unstake(ethers.parseEther("2"))
      ).to.changeEtherBalance(alice, ethers.parseEther("2"));

      expect(await staking.staked(alice.address)).to.equal(0n);
      // Reward earned during the day is preserved and still claimable.
      expect(await staking.earned(alice.address)).to.be.closeTo(
        ethers.parseEther("2"),
        ethers.parseEther("0.01")
      );
    });

    it("supports partial unstake", async function () {
      const { staking, alice } = await deploy();
      await staking.connect(alice).stake({ value: ethers.parseEther("3") });
      await staking.connect(alice).unstake(ethers.parseEther("1"));
      expect(await staking.staked(alice.address)).to.equal(
        ethers.parseEther("2")
      );
      expect(await staking.totalStaked()).to.equal(ethers.parseEther("2"));
    });

    it("rejects unstaking more than staked", async function () {
      const { staking, alice } = await deploy();
      await staking.connect(alice).stake({ value: ethers.parseEther("1") });
      await expect(
        staking.connect(alice).unstake(ethers.parseEther("2"))
      ).to.be.revertedWith("Not enough staked");
    });

    it("stops accruing rewards after a full unstake", async function () {
      const { staking, alice } = await deploy();
      await staking.connect(alice).stake({ value: ethers.parseEther("1") });
      await time.increase(DAY);
      await staking.connect(alice).unstake(ethers.parseEther("1"));

      const before = await staking.earned(alice.address);
      await time.increase(DAY);
      const after = await staking.earned(alice.address);
      expect(after).to.equal(before); // nothing staked => no new rewards
    });
  });

  describe("More coverage", function () {
    it("sums totalStaked across stakers", async function () {
      const { staking, alice, bob } = await deploy();
      await staking.connect(alice).stake({ value: ethers.parseEther("1") });
      await staking.connect(bob).stake({ value: ethers.parseEther("2") });
      expect(await staking.totalStaked()).to.equal(ethers.parseEther("3"));
    });

    it("keeps accruing on the remainder after a partial unstake", async function () {
      const { staking, alice } = await deploy();
      await staking.connect(alice).stake({ value: ethers.parseEther("2") });
      await time.increase(DAY); // ~2 tokens earned so far
      await staking.connect(alice).unstake(ethers.parseEther("1")); // settles, 1 ETH left
      await time.increase(DAY); // ~1 more token on the remaining 1 ETH

      const earned = await staking.earned(alice.address);
      expect(earned).to.be.closeTo(
        ethers.parseEther("3"),
        ethers.parseEther("0.01")
      );
    });

    it("lets a user claim more than once over time", async function () {
      const { staking, alice } = await deploy();
      await staking.connect(alice).stake({ value: ethers.parseEther("1") });
      await time.increase(DAY);
      await staking.connect(alice).claim();
      await time.increase(DAY);
      await staking.connect(alice).claim();
      // Two days of 1 ETH => ~2 BSR total.
      expect(await staking.balanceOf(alice.address)).to.be.closeTo(
        ethers.parseEther("2"),
        ethers.parseEther("0.02")
      );
    });
  });
});
