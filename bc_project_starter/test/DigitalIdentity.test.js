const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DigitalIdentity", function () {
  let digitalIdentity;
  let owner, user1, user2;
  let idHash, emailHash, studentIdHash;
  let credentialTypeHash, credentialHash;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const DigitalIdentity = await ethers.getContractFactory("DigitalIdentity");
    digitalIdentity = await DigitalIdentity.deploy();
    await digitalIdentity.waitForDeployment();

    // Sample hashed data
    idHash = ethers.keccak256(ethers.toUtf8Bytes("USER123"));
    emailHash = ethers.keccak256(ethers.toUtf8Bytes("user@test.com"));
    studentIdHash = ethers.keccak256(ethers.toUtf8Bytes("S2024001"));

    credentialTypeHash = ethers.keccak256(ethers.toUtf8Bytes("Bachelor_Diploma"));
    credentialHash = ethers.keccak256(ethers.toUtf8Bytes("DIPLOMA_CONTENT_HASH"));
  });

  describe("User Registration", function () {
    it("Should register a new user successfully", async function () {
      await digitalIdentity.connect(user1).RegisterUser(
        idHash,
        emailHash,
        studentIdHash
      );

      expect(await digitalIdentity.IsRegistered(user1.address)).to.be.true;
    });

    it("Should emit IdentityRegistered event", async function () {
      await expect(
        digitalIdentity.connect(user1).RegisterUser(idHash, emailHash, studentIdHash)
      )
        .to.emit(digitalIdentity, "IdentityRegistered")
        .withArgs(user1.address, idHash, await ethers.provider.getBlock("latest").then(b => b.timestamp + 1));
    });

    it("Should prevent duplicate registration", async function () {
      await digitalIdentity.connect(user1).RegisterUser(idHash, emailHash, studentIdHash);

      await expect(
        digitalIdentity.connect(user1).RegisterUser(idHash, emailHash, studentIdHash)
      ).to.be.revertedWithCustomError(digitalIdentity, "AlreadyRegistered");
    });

    it("Should reject zero address hash parameters", async function () {
      const zeroHash = ethers.ZeroHash;

      await expect(
        digitalIdentity.connect(user1).RegisterUser(zeroHash, emailHash, studentIdHash)
      ).to.be.revertedWithCustomError(digitalIdentity, "InvalidParameter");

      await expect(
        digitalIdentity.connect(user1).RegisterUser(idHash, zeroHash, studentIdHash)
      ).to.be.revertedWithCustomError(digitalIdentity, "InvalidParameter");

      await expect(
        digitalIdentity.connect(user1).RegisterUser(idHash, emailHash, zeroHash)
      ).to.be.revertedWithCustomError(digitalIdentity, "InvalidParameter");
    });

    it("Should allow multiple users to register", async function () {
      const user1IdHash = ethers.keccak256(ethers.toUtf8Bytes("USER1"));
      const user1EmailHash = ethers.keccak256(ethers.toUtf8Bytes("user1@test.com"));
      const user1StudentIdHash = ethers.keccak256(ethers.toUtf8Bytes("S001"));

      const user2IdHash = ethers.keccak256(ethers.toUtf8Bytes("USER2"));
      const user2EmailHash = ethers.keccak256(ethers.toUtf8Bytes("user2@test.com"));
      const user2StudentIdHash = ethers.keccak256(ethers.toUtf8Bytes("S002"));

      await digitalIdentity.connect(user1).RegisterUser(
        user1IdHash,
        user1EmailHash,
        user1StudentIdHash
      );

      await digitalIdentity.connect(user2).RegisterUser(
        user2IdHash,
        user2EmailHash,
        user2StudentIdHash
      );

      expect(await digitalIdentity.IsRegistered(user1.address)).to.be.true;
      expect(await digitalIdentity.IsRegistered(user2.address)).to.be.true;
    });
  });

  describe("Credential Storage", function () {
    beforeEach(async function () {
      // Register user first
      await digitalIdentity.connect(user1).RegisterUser(idHash, emailHash, studentIdHash);
    });

    it("Should store a credential successfully", async function () {
      await digitalIdentity.connect(user1).StoreCredential(
        credentialTypeHash,
        credentialHash
      );

      expect(await digitalIdentity.CredentialExists(user1.address, credentialTypeHash)).to.be.true;
    });

    it("Should emit CredentialStored event", async function () {
      await expect(
        digitalIdentity.connect(user1).StoreCredential(credentialTypeHash, credentialHash)
      )
        .to.emit(digitalIdentity, "CredentialStored")
        .withArgs(
          user1.address,
          credentialTypeHash,
          credentialHash,
          await ethers.provider.getBlock("latest").then(b => b.timestamp + 1)
        );
    });

    it("Should allow updating existing credential", async function () {
      await digitalIdentity.connect(user1).StoreCredential(credentialTypeHash, credentialHash);

      const newCredentialHash = ethers.keccak256(ethers.toUtf8Bytes("NEW_DIPLOMA_CONTENT"));
      await digitalIdentity.connect(user1).StoreCredential(credentialTypeHash, newCredentialHash);

      const retrievedHash = await digitalIdentity.GetCredentialHash(user1.address, credentialTypeHash);
      expect(retrievedHash).to.equal(newCredentialHash);
    });

    it("Should reject credential storage from unregistered user", async function () {
      await expect(
        digitalIdentity.connect(user2).StoreCredential(credentialTypeHash, credentialHash)
      ).to.be.revertedWithCustomError(digitalIdentity, "UserNotRegistered");
    });

    it("Should reject zero hash parameters", async function () {
      const zeroHash = ethers.ZeroHash;

      await expect(
        digitalIdentity.connect(user1).StoreCredential(zeroHash, credentialHash)
      ).to.be.revertedWithCustomError(digitalIdentity, "InvalidParameter");

      await expect(
        digitalIdentity.connect(user1).StoreCredential(credentialTypeHash, zeroHash)
      ).to.be.revertedWithCustomError(digitalIdentity, "InvalidParameter");
    });

    it("Should allow storing multiple credential types", async function () {
      const transcriptTypeHash = ethers.keccak256(ethers.toUtf8Bytes("Transcript"));
      const transcriptHash = ethers.keccak256(ethers.toUtf8Bytes("TRANSCRIPT_CONTENT"));

      await digitalIdentity.connect(user1).StoreCredential(credentialTypeHash, credentialHash);
      await digitalIdentity.connect(user1).StoreCredential(transcriptTypeHash, transcriptHash);

      expect(await digitalIdentity.CredentialExists(user1.address, credentialTypeHash)).to.be.true;
      expect(await digitalIdentity.CredentialExists(user1.address, transcriptTypeHash)).to.be.true;
    });
  });

  describe("Credential Retrieval", function () {
    beforeEach(async function () {
      await digitalIdentity.connect(user1).RegisterUser(idHash, emailHash, studentIdHash);
      await digitalIdentity.connect(user1).StoreCredential(credentialTypeHash, credentialHash);
    });

    it("Should retrieve credential hash correctly", async function () {
      const retrievedHash = await digitalIdentity.GetCredentialHash(
        user1.address,
        credentialTypeHash
      );

      expect(retrievedHash).to.equal(credentialHash);
    });

    it("Should revert when retrieving non-existent credential", async function () {
      const nonExistentTypeHash = ethers.keccak256(ethers.toUtf8Bytes("NonExistent"));

      await expect(
        digitalIdentity.GetCredentialHash(user1.address, nonExistentTypeHash)
      ).to.be.revertedWithCustomError(digitalIdentity, "CredentialNotFound");
    });

    it("Should check credential existence correctly", async function () {
      expect(await digitalIdentity.CredentialExists(user1.address, credentialTypeHash)).to.be.true;

      const nonExistentTypeHash = ethers.keccak256(ethers.toUtf8Bytes("NonExistent"));
      expect(await digitalIdentity.CredentialExists(user1.address, nonExistentTypeHash)).to.be.false;
    });
  });

  describe("User Query Functions", function () {
    beforeEach(async function () {
      await digitalIdentity.connect(user1).RegisterUser(idHash, emailHash, studentIdHash);
    });

    it("Should return correct registration status", async function () {
      expect(await digitalIdentity.IsRegistered(user1.address)).to.be.true;
      expect(await digitalIdentity.IsRegistered(user2.address)).to.be.false;
    });

    it("Should retrieve user ID hash", async function () {
      const retrievedIdHash = await digitalIdentity.GetUserIdHash(user1.address);
      expect(retrievedIdHash).to.equal(idHash);
    });

    it("Should revert for unregistered user", async function () {
      await expect(
        digitalIdentity.GetUserIdHash(user2.address)
      ).to.be.revertedWithCustomError(digitalIdentity, "UserNotRegistered");
    });
  });

  describe("Edge Cases", function () {
    it("Should handle empty credential list", async function () {
      await digitalIdentity.connect(user1).RegisterUser(idHash, emailHash, studentIdHash);

      expect(await digitalIdentity.CredentialExists(user1.address, credentialTypeHash)).to.be.false;
    });

    it("Should isolate credentials between users", async function () {
      const user2IdHash = ethers.keccak256(ethers.toUtf8Bytes("USER2"));
      const user2EmailHash = ethers.keccak256(ethers.toUtf8Bytes("user2@test.com"));
      const user2StudentIdHash = ethers.keccak256(ethers.toUtf8Bytes("S002"));

      await digitalIdentity.connect(user1).RegisterUser(idHash, emailHash, studentIdHash);
      await digitalIdentity.connect(user2).RegisterUser(user2IdHash, user2EmailHash, user2StudentIdHash);

      await digitalIdentity.connect(user1).StoreCredential(credentialTypeHash, credentialHash);

      expect(await digitalIdentity.CredentialExists(user1.address, credentialTypeHash)).to.be.true;
      expect(await digitalIdentity.CredentialExists(user2.address, credentialTypeHash)).to.be.false;
    });
  });
});
