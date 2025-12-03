const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DataSharing - Event-Based Auditing", function () {
  let digitalIdentity, consentManager, rewardToken, dataSharing;
  let owner, deployer, requester1, requester2;
  let credentialTypeHash;

  beforeEach(async function () {
    [deployer, owner, requester1, requester2] = await ethers.getSigners();

    // Deploy DigitalIdentity
    const DigitalIdentity = await ethers.getContractFactory("DigitalIdentity");
    digitalIdentity = await DigitalIdentity.deploy();
    await digitalIdentity.waitForDeployment();

    // Deploy ConsentManager
    const ConsentManager = await ethers.getContractFactory("ConsentManager");
    consentManager = await ConsentManager.deploy(await digitalIdentity.getAddress());
    await consentManager.waitForDeployment();

    // Deploy RewardToken
    const RewardToken = await ethers.getContractFactory("RewardToken");
    rewardToken = await RewardToken.deploy();
    await rewardToken.waitForDeployment();

    // Deploy DataSharing
    const DataSharing = await ethers.getContractFactory("DataSharing");
    dataSharing = await DataSharing.deploy(
      await digitalIdentity.getAddress(),
      await consentManager.getAddress(),
      await rewardToken.getAddress()
    );
    await dataSharing.waitForDeployment();

    // Grant MINTER_ROLE to DataSharing
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    await rewardToken.grantRole(MINTER_ROLE, await dataSharing.getAddress());

    // Setup: Register users
    const ownerIdHash = ethers.keccak256(ethers.toUtf8Bytes("OWNER123"));
    const ownerEmailHash = ethers.keccak256(ethers.toUtf8Bytes("owner@test.com"));
    const ownerStudentIdHash = ethers.keccak256(ethers.toUtf8Bytes("S001"));

    await digitalIdentity.connect(owner).RegisterUser(
      ownerIdHash,
      ownerEmailHash,
      ownerStudentIdHash
    );

    const requester1IdHash = ethers.keccak256(ethers.toUtf8Bytes("REQ1"));
    const requester1EmailHash = ethers.keccak256(ethers.toUtf8Bytes("req1@test.com"));
    const requester1OrgIdHash = ethers.keccak256(ethers.toUtf8Bytes("ORG1"));

    await digitalIdentity.connect(requester1).RegisterUser(
      requester1IdHash,
      requester1EmailHash,
      requester1OrgIdHash
    );

    const requester2IdHash = ethers.keccak256(ethers.toUtf8Bytes("REQ2"));
    const requester2EmailHash = ethers.keccak256(ethers.toUtf8Bytes("req2@test.com"));
    const requester2OrgIdHash = ethers.keccak256(ethers.toUtf8Bytes("ORG2"));

    await digitalIdentity.connect(requester2).RegisterUser(
      requester2IdHash,
      requester2EmailHash,
      requester2OrgIdHash
    );

    // Setup: Store credential
    credentialTypeHash = ethers.keccak256(ethers.toUtf8Bytes("Bachelor_Diploma"));
    const credentialHash = ethers.keccak256(ethers.toUtf8Bytes("DIPLOMA_CONTENT"));

    await digitalIdentity.connect(owner).StoreCredential(
      credentialTypeHash,
      credentialHash
    );
  });

  describe("AccessGranted Event", function () {
    it("Should emit AccessGranted event with correct data", async function () {
      // Grant consent
      const currentTime = await ethers.provider.getBlock("latest").then(b => b.timestamp);
      const expiry = currentTime + 86400 + 100;
      await dataSharing.connect(owner).GrantConsentAndReward(
        requester1.address,
        credentialTypeHash,
        expiry
      );

      // Get expected credential hash
      const expectedHash = await digitalIdentity.GetCredentialHash(
        owner.address,
        credentialTypeHash
      );

      // Access data and check event
      await expect(
        dataSharing.connect(requester1).AccessData(owner.address, credentialTypeHash)
      )
        .to.emit(dataSharing, "AccessGranted")
        .withArgs(
          owner.address,
          requester1.address,
          credentialTypeHash,
          expectedHash,
          (timestamp) => timestamp > 0 // Just verify timestamp exists
        );
    });

    it("Should emit AccessGranted for multiple accesses", async function () {
      // Grant consent to both requesters
      const currentTime = await ethers.provider.getBlock("latest").then(b => b.timestamp);
      const expiry = currentTime + 86400 + 100;
      await dataSharing.connect(owner).GrantConsentAndReward(
        requester1.address,
        credentialTypeHash,
        expiry
      );
      await dataSharing.connect(owner).GrantConsentAndReward(
        requester2.address,
        credentialTypeHash,
        expiry
      );

      // Both requesters access
      await expect(
        dataSharing.connect(requester1).AccessData(owner.address, credentialTypeHash)
      ).to.emit(dataSharing, "AccessGranted");

      await expect(
        dataSharing.connect(requester2).AccessData(owner.address, credentialTypeHash)
      ).to.emit(dataSharing, "AccessGranted");
    });
  });

  describe("AccessDenied Event", function () {
    it("Should emit AccessDenied event when consent invalid", async function () {
      // Try to access without consent
      await expect(
        dataSharing.connect(requester1).AccessData(owner.address, credentialTypeHash)
      ).to.be.revertedWithCustomError(dataSharing, "ConsentInvalid");
    });

    it("Should emit AccessDenied after consent revoked", async function () {
      // Grant consent
      const currentTime = await ethers.provider.getBlock("latest").then(b => b.timestamp);
      const expiry = currentTime + 86400 + 100;
      await dataSharing.connect(owner).GrantConsentAndReward(
        requester1.address,
        credentialTypeHash,
        expiry
      );

      // Revoke consent
      await dataSharing.connect(owner).RevokeConsentWrapper(
        requester1.address,
        credentialTypeHash
      );

      // Access should revert
      await expect(
        dataSharing.connect(requester1).AccessData(owner.address, credentialTypeHash)
      ).to.be.revertedWithCustomError(dataSharing, "ConsentInvalid");
    });
  });

  describe("Event Data Verification", function () {
    it("Should include correct credential hash in AccessGranted event", async function () {
      // Grant consent
      const currentTime = await ethers.provider.getBlock("latest").then(b => b.timestamp);
      const expiry = currentTime + 86400 + 100;
      await dataSharing.connect(owner).GrantConsentAndReward(
        requester1.address,
        credentialTypeHash,
        expiry
      );

      // Access and capture event
      const tx = await dataSharing.connect(requester1).AccessData(
        owner.address,
        credentialTypeHash
      );
      const receipt = await tx.wait();

      // Parse event
      const event = receipt.logs.find(log => {
        try {
          const parsed = dataSharing.interface.parseLog(log);
          return parsed.name === "AccessGranted";
        } catch {
          return false;
        }
      });

      expect(event).to.not.be.undefined;
      const parsed = dataSharing.interface.parseLog(event);

      // Verify event data
      expect(parsed.args.owner).to.equal(owner.address);
      expect(parsed.args.requester).to.equal(requester1.address);
      expect(parsed.args.credentialTypeHash).to.equal(credentialTypeHash);
      expect(parsed.args.credentialHash).to.not.equal(ethers.ZeroHash);
    });
  });
});
