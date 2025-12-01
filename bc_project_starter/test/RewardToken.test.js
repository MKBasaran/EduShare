const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RewardToken", function () {
  let rewardToken;
  let owner, minter, user1, user2;
  let MINTER_ROLE;

  beforeEach(async function () {
    [owner, minter, user1, user2] = await ethers.getSigners();

    const RewardToken = await ethers.getContractFactory("RewardToken");
    rewardToken = await RewardToken.deploy();
    await rewardToken.waitForDeployment();

    MINTER_ROLE = await rewardToken.MINTER_ROLE();
  });

  describe("Deployment", function () {
    it("Should deploy with correct name and symbol", async function () {
      expect(await rewardToken.name()).to.equal("EduShareToken");
      expect(await rewardToken.symbol()).to.equal("EDUSHARE");
    });

    it("Should grant DEFAULT_ADMIN_ROLE to deployer", async function () {
      const DEFAULT_ADMIN_ROLE = await rewardToken.DEFAULT_ADMIN_ROLE();
      expect(await rewardToken.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("Should have 18 decimals by default", async function () {
      expect(await rewardToken.decimals()).to.equal(18);
    });

    it("Should start with zero total supply", async function () {
      expect(await rewardToken.totalSupply()).to.equal(0);
    });
  });

  describe("Role Management", function () {
    it("Should allow admin to grant MINTER_ROLE", async function () {
      await rewardToken.connect(owner).grantRole(MINTER_ROLE, minter.address);
      expect(await rewardToken.hasRole(MINTER_ROLE, minter.address)).to.be.true;
    });

    it("Should reject granting MINTER_ROLE from non-admin", async function () {
      const DEFAULT_ADMIN_ROLE = await rewardToken.DEFAULT_ADMIN_ROLE();

      await expect(
        rewardToken.connect(user1).grantRole(MINTER_ROLE, user2.address)
      ).to.be.revertedWithCustomError(rewardToken, "AccessControlUnauthorizedAccount")
        .withArgs(user1.address, DEFAULT_ADMIN_ROLE);
    });

    it("Should allow admin to revoke MINTER_ROLE", async function () {
      await rewardToken.connect(owner).grantRole(MINTER_ROLE, minter.address);
      await rewardToken.connect(owner).revokeRole(MINTER_ROLE, minter.address);

      expect(await rewardToken.hasRole(MINTER_ROLE, minter.address)).to.be.false;
    });

    it("Should allow role holder to renounce their own role", async function () {
      await rewardToken.connect(owner).grantRole(MINTER_ROLE, minter.address);
      await rewardToken.connect(minter).renounceRole(MINTER_ROLE, minter.address);

      expect(await rewardToken.hasRole(MINTER_ROLE, minter.address)).to.be.false;
    });
  });

  describe("Minting", function () {
    beforeEach(async function () {
      await rewardToken.connect(owner).grantRole(MINTER_ROLE, minter.address);
    });

    it("Should mint tokens successfully", async function () {
      const amount = ethers.parseEther("100");
      await rewardToken.connect(minter).mint(user1.address, amount);

      expect(await rewardToken.balanceOf(user1.address)).to.equal(amount);
    });

    it("Should emit TokensRewarded event", async function () {
      const amount = ethers.parseEther("100");

      await expect(
        rewardToken.connect(minter).mint(user1.address, amount)
      )
        .to.emit(rewardToken, "TokensRewarded")
        .withArgs(user1.address, amount);
    });

    it("Should increase total supply when minting", async function () {
      const amount = ethers.parseEther("100");
      await rewardToken.connect(minter).mint(user1.address, amount);

      expect(await rewardToken.totalSupply()).to.equal(amount);
    });

    it("Should reject minting from non-minter", async function () {
      const amount = ethers.parseEther("100");

      await expect(
        rewardToken.connect(user1).mint(user2.address, amount)
      ).to.be.revertedWithCustomError(rewardToken, "AccessControlUnauthorizedAccount")
        .withArgs(user1.address, MINTER_ROLE);
    });

    it("Should allow multiple mints to same user", async function () {
      const amount1 = ethers.parseEther("50");
      const amount2 = ethers.parseEther("75");

      await rewardToken.connect(minter).mint(user1.address, amount1);
      await rewardToken.connect(minter).mint(user1.address, amount2);

      expect(await rewardToken.balanceOf(user1.address)).to.equal(amount1 + amount2);
    });

    it("Should allow minting to multiple users", async function () {
      const amount1 = ethers.parseEther("100");
      const amount2 = ethers.parseEther("200");

      await rewardToken.connect(minter).mint(user1.address, amount1);
      await rewardToken.connect(minter).mint(user2.address, amount2);

      expect(await rewardToken.balanceOf(user1.address)).to.equal(amount1);
      expect(await rewardToken.balanceOf(user2.address)).to.equal(amount2);
    });
  });

  describe("ERC20 Functionality", function () {
    beforeEach(async function () {
      await rewardToken.connect(owner).grantRole(MINTER_ROLE, minter.address);
      const amount = ethers.parseEther("1000");
      await rewardToken.connect(minter).mint(user1.address, amount);
    });

    it("Should allow token transfers", async function () {
      const transferAmount = ethers.parseEther("100");
      await rewardToken.connect(user1).transfer(user2.address, transferAmount);

      expect(await rewardToken.balanceOf(user2.address)).to.equal(transferAmount);
      expect(await rewardToken.balanceOf(user1.address)).to.equal(
        ethers.parseEther("900")
      );
    });

    it("Should reject transfer with insufficient balance", async function () {
      const excessiveAmount = ethers.parseEther("2000");

      await expect(
        rewardToken.connect(user1).transfer(user2.address, excessiveAmount)
      ).to.be.revertedWithCustomError(rewardToken, "ERC20InsufficientBalance");
    });

    it("Should allow approval and transferFrom", async function () {
      const approvalAmount = ethers.parseEther("100");
      await rewardToken.connect(user1).approve(user2.address, approvalAmount);

      expect(await rewardToken.allowance(user1.address, user2.address)).to.equal(
        approvalAmount
      );

      await rewardToken.connect(user2).transferFrom(
        user1.address,
        user2.address,
        approvalAmount
      );

      expect(await rewardToken.balanceOf(user2.address)).to.equal(approvalAmount);
    });

    it("Should reject transferFrom without approval", async function () {
      const amount = ethers.parseEther("100");

      await expect(
        rewardToken.connect(user2).transferFrom(user1.address, user2.address, amount)
      ).to.be.revertedWithCustomError(rewardToken, "ERC20InsufficientAllowance");
    });

    it("Should track balances correctly", async function () {
      expect(await rewardToken.balanceOf(user1.address)).to.equal(
        ethers.parseEther("1000")
      );
      expect(await rewardToken.balanceOf(user2.address)).to.equal(0);
    });
  });

  describe("Interface Support", function () {
    it("Should support AccessControl interface", async function () {
      // ERC165 interface ID for AccessControl is 0x7965db0b
      const accessControlInterfaceId = "0x7965db0b";
      expect(await rewardToken.supportsInterface(accessControlInterfaceId)).to.be.true;
    });
  });
});
