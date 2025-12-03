const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ConsentManager", function () {
  let digitalIdentity;
  let consentManager;
  let owner, user1, user2, user3;
  let idHash1, emailHash1, studentIdHash1;
  let idHash2, emailHash2, studentIdHash2;
  let credentialTypeHash, credentialHash;

  beforeEach(async function () {
    [owner, user1, user2, user3] = await ethers.getSigners();

    // Deploy DigitalIdentity first
    const DigitalIdentity = await ethers.getContractFactory("DigitalIdentity");
    digitalIdentity = await DigitalIdentity.deploy();
    await digitalIdentity.waitForDeployment();

    // Deploy ConsentManager
    const ConsentManager = await ethers.getContractFactory("ConsentManager");
    consentManager = await ConsentManager.deploy(await digitalIdentity.getAddress());
    await consentManager.waitForDeployment();

    // Setup test data
    idHash1 = ethers.keccak256(ethers.toUtf8Bytes("USER1"));
    emailHash1 = ethers.keccak256(ethers.toUtf8Bytes("user1@test.com"));
    studentIdHash1 = ethers.keccak256(ethers.toUtf8Bytes("S001"));

    idHash2 = ethers.keccak256(ethers.toUtf8Bytes("USER2"));
    emailHash2 = ethers.keccak256(ethers.toUtf8Bytes("user2@test.com"));
    studentIdHash2 = ethers.keccak256(ethers.toUtf8Bytes("S002"));

    credentialTypeHash = ethers.keccak256(ethers.toUtf8Bytes("Bachelor_Diploma"));
    credentialHash = ethers.keccak256(ethers.toUtf8Bytes("DIPLOMA_CONTENT"));

    // Register two users and store credential for user1
    await digitalIdentity.connect(user1).RegisterUser(idHash1, emailHash1, studentIdHash1);
    await digitalIdentity.connect(user2).RegisterUser(idHash2, emailHash2, studentIdHash2);
    await digitalIdentity.connect(user1).StoreCredential(credentialTypeHash, credentialHash);
  });

  describe("Consent Granting", function () {
    it("Should grant consent successfully", async function () {
      const futureTimestamp = (await time.latest()) + 86400 * 30; // 30 days from now

      await consentManager.SetConsent(
        user1.address,
        user2.address,
        credentialTypeHash,
        futureTimestamp
      );

      expect(
        await consentManager.CheckConsent(user1.address, user2.address, credentialTypeHash)
      ).to.be.true;
    });

    it("Should emit ConsentGranted event", async function () {
      const futureTimestamp = (await time.latest()) + 86400 * 30;

      await expect(
        consentManager.SetConsent(
          user1.address,
          user2.address,
          credentialTypeHash,
          futureTimestamp
        )
      )
        .to.emit(consentManager, "ConsentGranted")
        .withArgs(
          user1.address,
          user2.address,
          credentialTypeHash,
          futureTimestamp,
          await ethers.provider.getBlock("latest").then(b => b.timestamp + 1)
        );
    });

    it("Should reject if owner is not registered", async function () {
      const futureTimestamp = (await time.latest()) + 86400 * 30;

      await expect(
        consentManager.SetConsent(
          user3.address, // Not registered
          user2.address,
          credentialTypeHash,
          futureTimestamp
        )
      ).to.be.revertedWithCustomError(consentManager, "UserNotRegistered");
    });

    it("Should reject if requester is not registered", async function () {
      const futureTimestamp = (await time.latest()) + 86400 * 30;

      await expect(
        consentManager.SetConsent(
          user1.address,
          user3.address, // Not registered
          credentialTypeHash,
          futureTimestamp
        )
      ).to.be.revertedWithCustomError(consentManager, "RequesterNotRegistered");
    });

    it("Should reject if credential does not exist", async function () {
      const futureTimestamp = (await time.latest()) + 86400 * 30;
      const nonExistentCredential = ethers.keccak256(ethers.toUtf8Bytes("NonExistent"));

      await expect(
        consentManager.SetConsent(
          user1.address,
          user2.address,
          nonExistentCredential,
          futureTimestamp
        )
      ).to.be.revertedWithCustomError(digitalIdentity, "CredentialNotFound");
    });

    it("Should reject if expiry is in the past", async function () {
      const pastTimestamp = (await time.latest()) - 1000;

      await expect(
        consentManager.SetConsent(
          user1.address,
          user2.address,
          credentialTypeHash,
          pastTimestamp
        )
      ).to.be.revertedWithCustomError(consentManager, "InvalidExpiryTimestamp");
    });

    it("Should reject if duration is less than 1 day", async function () {
      const tooSoonTimestamp = (await time.latest()) + 86400 - 1; // Just under 1 day

      await expect(
        consentManager.SetConsent(
          user1.address,
          user2.address,
          credentialTypeHash,
          tooSoonTimestamp
        )
      ).to.be.revertedWithCustomError(consentManager, "InvalidConsentDuration");
    });

    it("Should reject if duration is more than 365 days", async function () {
      const tooLateTimestamp = (await time.latest()) + 86400 * 366; // Over 365 days

      await expect(
        consentManager.SetConsent(
          user1.address,
          user2.address,
          credentialTypeHash,
          tooLateTimestamp
        )
      ).to.be.revertedWithCustomError(consentManager, "InvalidConsentDuration");
    });

    it("Should reject if granting consent to self", async function () {
      const futureTimestamp = (await time.latest()) + 86400 * 30;

      await expect(
        consentManager.SetConsent(
          user1.address,
          user1.address, // Same as owner
          credentialTypeHash,
          futureTimestamp
        )
      ).to.be.revertedWithCustomError(consentManager, "CannotGrantToSelf");
    });

    it("Should allow updating existing consent with new expiry", async function () {
      const firstExpiry = (await time.latest()) + 86400 * 30;
      const secondExpiry = (await time.latest()) + 86400 * 60;

      await consentManager.SetConsent(
        user1.address,
        user2.address,
        credentialTypeHash,
        firstExpiry
      );

      await consentManager.SetConsent(
        user1.address,
        user2.address,
        credentialTypeHash,
        secondExpiry
      );

      const expiry = await consentManager.GetConsentExpiry(
        user1.address,
        user2.address,
        credentialTypeHash
      );
      expect(expiry).to.equal(secondExpiry);
    });

    it("Should accept consent duration of exactly 1 day", async function () {
      const exactlyOneDay = (await time.latest()) + 86400 + 1; // Add 1 second buffer for block mining

      await expect(
        consentManager.SetConsent(
          user1.address,
          user2.address,
          credentialTypeHash,
          exactlyOneDay
        )
      ).to.not.be.reverted;
    });

    it("Should accept consent duration of exactly 365 days", async function () {
      const exactly365Days = (await time.latest()) + 86400 * 365;

      await expect(
        consentManager.SetConsent(
          user1.address,
          user2.address,
          credentialTypeHash,
          exactly365Days
        )
      ).to.not.be.reverted;
    });
  });

  describe("Consent Revocation", function () {
    beforeEach(async function () {
      const futureTimestamp = (await time.latest()) + 86400 * 30;
      await consentManager.SetConsent(
        user1.address,
        user2.address,
        credentialTypeHash,
        futureTimestamp
      );
    });

    it("Should revoke consent successfully", async function () {
      await consentManager.RevokeConsent(
        user1.address,
        user2.address,
        credentialTypeHash
      );

      expect(
        await consentManager.CheckConsent(user1.address, user2.address, credentialTypeHash)
      ).to.be.false;
    });

    it("Should emit ConsentRevoked event", async function () {
      await expect(
        consentManager.RevokeConsent(
          user1.address,
          user2.address,
          credentialTypeHash
        )
      )
        .to.emit(consentManager, "ConsentRevoked")
        .withArgs(
          user1.address,
          user2.address,
          credentialTypeHash,
          await ethers.provider.getBlock("latest").then(b => b.timestamp + 1)
        );
    });

    it("Should reject revoking non-existent consent", async function () {
      const nonExistentCredential = ethers.keccak256(ethers.toUtf8Bytes("NonExistent"));

      await expect(
        consentManager.RevokeConsent(
          user1.address,
          user2.address,
          nonExistentCredential
        )
      ).to.be.revertedWithCustomError(consentManager, "ConsentNotFound");
    });

    it("Should allow granting the same consent again after revocation", async function () {
      await consentManager.RevokeConsent(
        user1.address,
        user2.address,
        credentialTypeHash
      );

      const newExpiry = (await time.latest()) + 86400 * 45;
      await consentManager.SetConsent(
        user1.address,
        user2.address,
        credentialTypeHash,
        newExpiry
      );

      expect(
        await consentManager.CheckConsent(user1.address, user2.address, credentialTypeHash)
      ).to.be.true;
    });
  });

  describe("Consent Checking", function () {
    it("Should return true for valid consent", async function () {
      const futureTimestamp = (await time.latest()) + 86400 * 30;
      await consentManager.SetConsent(
        user1.address,
        user2.address,
        credentialTypeHash,
        futureTimestamp
      );

      expect(
        await consentManager.CheckConsent(user1.address, user2.address, credentialTypeHash)
      ).to.be.true;
    });

    it("Should return false for non-existent consent", async function () {
      expect(
        await consentManager.CheckConsent(user1.address, user2.address, credentialTypeHash)
      ).to.be.false;
    });

    it("Should return false for expired consent", async function () {
      const shortExpiry = (await time.latest()) + 86400 * 2; // 2 days
      await consentManager.SetConsent(
        user1.address,
        user2.address,
        credentialTypeHash,
        shortExpiry
      );

      // Fast forward past expiry
      await time.increaseTo(shortExpiry + 1);

      expect(
        await consentManager.CheckConsent(user1.address, user2.address, credentialTypeHash)
      ).to.be.false;
    });

    it("Should return false for revoked consent", async function () {
      const futureTimestamp = (await time.latest()) + 86400 * 30;
      await consentManager.SetConsent(
        user1.address,
        user2.address,
        credentialTypeHash,
        futureTimestamp
      );

      await consentManager.RevokeConsent(
        user1.address,
        user2.address,
        credentialTypeHash
      );

      expect(
        await consentManager.CheckConsent(user1.address, user2.address, credentialTypeHash)
      ).to.be.false;
    });
  });

  describe("Consent Query Functions", function () {
    beforeEach(async function () {
      const futureTimestamp = (await time.latest()) + 86400 * 30;
      await consentManager.SetConsent(
        user1.address,
        user2.address,
        credentialTypeHash,
        futureTimestamp
      );
    });

    it("Should return consent expiry timestamp", async function () {
      const expectedExpiry = (await time.latest()) + 86400 * 30;

      // Grant consent with known expiry
      await consentManager.SetConsent(
        user1.address,
        user2.address,
        credentialTypeHash,
        expectedExpiry
      );

      const actualExpiry = await consentManager.GetConsentExpiry(
        user1.address,
        user2.address,
        credentialTypeHash
      );

      expect(actualExpiry).to.equal(expectedExpiry);
    });

    it("Should revert when querying expiry of non-existent consent", async function () {
      const nonExistentCredential = ethers.keccak256(ethers.toUtf8Bytes("NonExistent"));

      await expect(
        consentManager.GetConsentExpiry(
          user1.address,
          user2.address,
          nonExistentCredential
        )
      ).to.be.revertedWithCustomError(consentManager, "ConsentNotFound");
    });

    it("Should return full consent info", async function () {
      const consentInfo = await consentManager.GetConsentInfo(
        user1.address,
        user2.address,
        credentialTypeHash
      );

      expect(consentInfo.exists).to.be.true;
      expect(consentInfo.revoked).to.be.false;
      expect(consentInfo.expiry).to.be.gt(await time.latest());
    });

    it("Should revert when querying info of non-existent consent", async function () {
      const nonExistentCredential = ethers.keccak256(ethers.toUtf8Bytes("NonExistent"));

      await expect(
        consentManager.GetConsentInfo(
          user1.address,
          user2.address,
          nonExistentCredential
        )
      ).to.be.revertedWithCustomError(consentManager, "ConsentNotFound");
    });
  });

  describe("Multiple Consent Management", function () {
    it("Should allow different users to grant consent for same credential type", async function () {
      const idHash3 = ethers.keccak256(ethers.toUtf8Bytes("USER3"));
      const emailHash3 = ethers.keccak256(ethers.toUtf8Bytes("user3@test.com"));
      const studentIdHash3 = ethers.keccak256(ethers.toUtf8Bytes("S003"));

      await digitalIdentity.connect(user3).RegisterUser(idHash3, emailHash3, studentIdHash3);
      await digitalIdentity.connect(user3).StoreCredential(credentialTypeHash, credentialHash);

      const futureTimestamp = (await time.latest()) + 86400 * 30;

      await consentManager.SetConsent(
        user1.address,
        user2.address,
        credentialTypeHash,
        futureTimestamp
      );

      await consentManager.SetConsent(
        user3.address,
        user2.address,
        credentialTypeHash,
        futureTimestamp
      );

      expect(
        await consentManager.CheckConsent(user1.address, user2.address, credentialTypeHash)
      ).to.be.true;
      expect(
        await consentManager.CheckConsent(user3.address, user2.address, credentialTypeHash)
      ).to.be.true;
    });

    it("Should isolate consents between different credential types", async function () {
      const transcriptTypeHash = ethers.keccak256(ethers.toUtf8Bytes("Transcript"));
      const transcriptHash = ethers.keccak256(ethers.toUtf8Bytes("TRANSCRIPT_CONTENT"));

      await digitalIdentity.connect(user1).StoreCredential(transcriptTypeHash, transcriptHash);

      const futureTimestamp = (await time.latest()) + 86400 * 30;

      await consentManager.SetConsent(
        user1.address,
        user2.address,
        credentialTypeHash,
        futureTimestamp
      );

      expect(
        await consentManager.CheckConsent(user1.address, user2.address, credentialTypeHash)
      ).to.be.true;
      expect(
        await consentManager.CheckConsent(user1.address, user2.address, transcriptTypeHash)
      ).to.be.false;
    });
  });
});
