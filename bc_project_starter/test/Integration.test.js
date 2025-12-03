const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Integration Tests - Full System", function () {
  let digitalIdentity;
  let consentManager;
  let rewardToken;
  let dataSharing;
  let owner, student, employer, university;
  let studentIdHash, studentEmailHash, studentStudentIdHash;
  let employerIdHash, employerEmailHash, employerStudentIdHash;
  let diplomaTypeHash, diplomaHash;
  let transcriptTypeHash, transcriptHash;

  beforeEach(async function () {
    [owner, student, employer, university] = await ethers.getSigners();

    // Deploy all contracts
    const DigitalIdentity = await ethers.getContractFactory("DigitalIdentity");
    digitalIdentity = await DigitalIdentity.deploy();
    await digitalIdentity.waitForDeployment();

    const ConsentManager = await ethers.getContractFactory("ConsentManager");
    consentManager = await ConsentManager.deploy(await digitalIdentity.getAddress());
    await consentManager.waitForDeployment();

    const RewardToken = await ethers.getContractFactory("RewardToken");
    rewardToken = await RewardToken.deploy();
    await rewardToken.waitForDeployment();

    const DataSharing = await ethers.getContractFactory("DataSharing");
    dataSharing = await DataSharing.deploy(
      await digitalIdentity.getAddress(),
      await consentManager.getAddress(),
      await rewardToken.getAddress()
    );
    await dataSharing.waitForDeployment();

    // Grant MINTER_ROLE to DataSharing contract
    const MINTER_ROLE = await rewardToken.MINTER_ROLE();
    await rewardToken.connect(owner).grantRole(MINTER_ROLE, await dataSharing.getAddress());

    // Setup test data
    studentIdHash = ethers.keccak256(ethers.toUtf8Bytes("STUDENT123"));
    studentEmailHash = ethers.keccak256(ethers.toUtf8Bytes("student@uni.edu"));
    studentStudentIdHash = ethers.keccak256(ethers.toUtf8Bytes("S2024001"));

    employerIdHash = ethers.keccak256(ethers.toUtf8Bytes("EMPLOYER456"));
    employerEmailHash = ethers.keccak256(ethers.toUtf8Bytes("hr@techcorp.com"));
    employerStudentIdHash = ethers.keccak256(ethers.toUtf8Bytes("EMP001"));

    diplomaTypeHash = ethers.keccak256(ethers.toUtf8Bytes("Bachelor_Diploma"));
    diplomaHash = ethers.keccak256(ethers.toUtf8Bytes("DIPLOMA_CONTENT_HASH"));

    transcriptTypeHash = ethers.keccak256(ethers.toUtf8Bytes("Transcript"));
    transcriptHash = ethers.keccak256(ethers.toUtf8Bytes("TRANSCRIPT_CONTENT_HASH"));
  });

  describe("Complete User Journey", function () {
    it("Should complete full workflow: register, store, consent, access", async function () {
      // Step 1: Register student and employer
      await digitalIdentity.connect(student).RegisterUser(
        studentIdHash,
        studentEmailHash,
        studentStudentIdHash
      );
      await digitalIdentity.connect(employer).RegisterUser(
        employerIdHash,
        employerEmailHash,
        employerStudentIdHash
      );

      expect(await digitalIdentity.IsRegistered(student.address)).to.be.true;
      expect(await digitalIdentity.IsRegistered(employer.address)).to.be.true;

      // Step 2: Student stores their diploma
      await digitalIdentity.connect(student).StoreCredential(diplomaTypeHash, diplomaHash);
      expect(await digitalIdentity.CredentialExists(student.address, diplomaTypeHash)).to.be.true;

      // Step 3: Student grants consent to employer through DataSharing
      const expiryTimestamp = (await time.latest()) + 86400 * 30; // 30 days
      await dataSharing.connect(student).GrantConsentAndReward(
        employer.address,
        diplomaTypeHash,
        expiryTimestamp
      );

      // Verify consent was granted
      expect(
        await dataSharing.CanAccess(student.address, employer.address, diplomaTypeHash)
      ).to.be.true;

      // Verify student received reward tokens
      const rewardAmount = ethers.parseEther("10");
      expect(await rewardToken.balanceOf(student.address)).to.equal(rewardAmount);

      // Step 4: Employer accesses the credential
      const tx = await dataSharing.connect(employer).AccessData(
        student.address,
        diplomaTypeHash
      );
      await tx.wait();

      // Verify through event or re-check with staticCall
      const retrievedHash = await dataSharing.connect(employer).AccessData.staticCall(
        student.address,
        diplomaTypeHash
      );
      expect(retrievedHash).to.equal(diplomaHash);

      // Verify access was logged
      const totalLogs = await dataSharing.totalAccessLogs();
      expect(totalLogs).to.equal(1);

      const accessLog = await dataSharing.getAccessLog(0);
      expect(accessLog.owner).to.equal(student.address);
      expect(accessLog.requester).to.equal(employer.address);
      expect(accessLog.granted).to.be.true;
    });

    it("Should handle consent revocation correctly", async function () {
      // Setup: register, store, grant consent
      await digitalIdentity.connect(student).RegisterUser(
        studentIdHash,
        studentEmailHash,
        studentStudentIdHash
      );
      await digitalIdentity.connect(employer).RegisterUser(
        employerIdHash,
        employerEmailHash,
        employerStudentIdHash
      );
      await digitalIdentity.connect(student).StoreCredential(diplomaTypeHash, diplomaHash);

      const expiryTimestamp = (await time.latest()) + 86400 * 30;
      await dataSharing.connect(student).GrantConsentAndReward(
        employer.address,
        diplomaTypeHash,
        expiryTimestamp
      );

      // Verify consent exists
      expect(
        await dataSharing.CanAccess(student.address, employer.address, diplomaTypeHash)
      ).to.be.true;

      // Revoke consent
      await dataSharing.connect(student).RevokeConsentWrapper(
        employer.address,
        diplomaTypeHash
      );

      // Verify consent no longer valid
      expect(
        await dataSharing.CanAccess(student.address, employer.address, diplomaTypeHash)
      ).to.be.false;

      // Verify access now fails
      await expect(
        dataSharing.connect(employer).AccessData(student.address, diplomaTypeHash)
      ).to.be.revertedWithCustomError(dataSharing, "ConsentInvalid");

      // Student still keeps their reward tokens
      const rewardAmount = ethers.parseEther("10");
      expect(await rewardToken.balanceOf(student.address)).to.equal(rewardAmount);
    });

    it("Should reject access without consent", async function () {
      // Register both users and store credential
      await digitalIdentity.connect(student).RegisterUser(
        studentIdHash,
        studentEmailHash,
        studentStudentIdHash
      );
      await digitalIdentity.connect(employer).RegisterUser(
        employerIdHash,
        employerEmailHash,
        employerStudentIdHash
      );
      await digitalIdentity.connect(student).StoreCredential(diplomaTypeHash, diplomaHash);

      // Try to access without consent - this should revert
      await expect(
        dataSharing.connect(employer).AccessData(student.address, diplomaTypeHash)
      ).to.be.revertedWithCustomError(dataSharing, "ConsentInvalid");

      // Note: When transaction reverts, no log is stored (state is rolled back)
      const totalLogs = await dataSharing.totalAccessLogs();
      expect(totalLogs).to.equal(0);
    });

    it("Should reject access after consent expires", async function () {
      // Setup with short expiry
      await digitalIdentity.connect(student).RegisterUser(
        studentIdHash,
        studentEmailHash,
        studentStudentIdHash
      );
      await digitalIdentity.connect(employer).RegisterUser(
        employerIdHash,
        employerEmailHash,
        employerStudentIdHash
      );
      await digitalIdentity.connect(student).StoreCredential(diplomaTypeHash, diplomaHash);

      const shortExpiry = (await time.latest()) + 86400 * 2; // 2 days
      await dataSharing.connect(student).GrantConsentAndReward(
        employer.address,
        diplomaTypeHash,
        shortExpiry
      );

      // Fast forward past expiry
      await time.increaseTo(shortExpiry + 1);

      // Try to access with expired consent
      await expect(
        dataSharing.connect(employer).AccessData(student.address, diplomaTypeHash)
      ).to.be.revertedWithCustomError(dataSharing, "ConsentInvalid");
    });
  });

  describe("Multiple Credentials and Users", function () {
    it("Should handle multiple credentials for same student", async function () {
      // Register users
      await digitalIdentity.connect(student).RegisterUser(
        studentIdHash,
        studentEmailHash,
        studentStudentIdHash
      );
      await digitalIdentity.connect(employer).RegisterUser(
        employerIdHash,
        employerEmailHash,
        employerStudentIdHash
      );

      // Store two different credentials
      await digitalIdentity.connect(student).StoreCredential(diplomaTypeHash, diplomaHash);
      await digitalIdentity.connect(student).StoreCredential(transcriptTypeHash, transcriptHash);

      // Grant consent for diploma only
      const expiryTimestamp = (await time.latest()) + 86400 * 30;
      await dataSharing.connect(student).GrantConsentAndReward(
        employer.address,
        diplomaTypeHash,
        expiryTimestamp
      );

      // Employer can access diploma
      await dataSharing.connect(employer).AccessData(student.address, diplomaTypeHash);

      // Verify the hash using staticCall
      const retrievedDiploma = await dataSharing.connect(employer).AccessData.staticCall(
        student.address,
        diplomaTypeHash
      );
      expect(retrievedDiploma).to.equal(diplomaHash);

      // Employer cannot access transcript (no consent)
      await expect(
        dataSharing.connect(employer).AccessData(student.address, transcriptTypeHash)
      ).to.be.revertedWithCustomError(dataSharing, "ConsentInvalid");

      // Student only got rewarded once
      const rewardAmount = ethers.parseEther("10");
      expect(await rewardToken.balanceOf(student.address)).to.equal(rewardAmount);
    });

    it("Should handle multiple employers accessing same credential", async function () {
      const employer2 = university;
      const employer2IdHash = ethers.keccak256(ethers.toUtf8Bytes("UNI789"));
      const employer2EmailHash = ethers.keccak256(ethers.toUtf8Bytes("admissions@uni.edu"));
      const employer2StudentIdHash = ethers.keccak256(ethers.toUtf8Bytes("U001"));

      // Register all users
      await digitalIdentity.connect(student).RegisterUser(
        studentIdHash,
        studentEmailHash,
        studentStudentIdHash
      );
      await digitalIdentity.connect(employer).RegisterUser(
        employerIdHash,
        employerEmailHash,
        employerStudentIdHash
      );
      await digitalIdentity.connect(employer2).RegisterUser(
        employer2IdHash,
        employer2EmailHash,
        employer2StudentIdHash
      );

      // Store credential
      await digitalIdentity.connect(student).StoreCredential(diplomaTypeHash, diplomaHash);

      // Grant consent to both employers
      const expiryTimestamp = (await time.latest()) + 86400 * 30;
      await dataSharing.connect(student).GrantConsentAndReward(
        employer.address,
        diplomaTypeHash,
        expiryTimestamp
      );
      await dataSharing.connect(student).GrantConsentAndReward(
        employer2.address,
        diplomaTypeHash,
        expiryTimestamp
      );

      // Both can access
      await dataSharing.connect(employer).AccessData(student.address, diplomaTypeHash);
      await dataSharing.connect(employer2).AccessData(student.address, diplomaTypeHash);

      // Verify hashes using staticCall
      const hash1 = await dataSharing.connect(employer).AccessData.staticCall(
        student.address,
        diplomaTypeHash
      );
      const hash2 = await dataSharing.connect(employer2).AccessData.staticCall(
        student.address,
        diplomaTypeHash
      );

      expect(hash1).to.equal(diplomaHash);
      expect(hash2).to.equal(diplomaHash);

      // Student got rewarded twice (once per consent)
      const rewardAmount = ethers.parseEther("20");
      expect(await rewardToken.balanceOf(student.address)).to.equal(rewardAmount);
    });

    it("Should isolate credentials between different students", async function () {
      const student2 = university;
      const student2IdHash = ethers.keccak256(ethers.toUtf8Bytes("STUDENT789"));
      const student2EmailHash = ethers.keccak256(ethers.toUtf8Bytes("student2@uni.edu"));
      const student2StudentIdHash = ethers.keccak256(ethers.toUtf8Bytes("S2024002"));
      const student2DiplomaHash = ethers.keccak256(ethers.toUtf8Bytes("DIFFERENT_DIPLOMA"));

      // Register both students and employer
      await digitalIdentity.connect(student).RegisterUser(
        studentIdHash,
        studentEmailHash,
        studentStudentIdHash
      );
      await digitalIdentity.connect(student2).RegisterUser(
        student2IdHash,
        student2EmailHash,
        student2StudentIdHash
      );
      await digitalIdentity.connect(employer).RegisterUser(
        employerIdHash,
        employerEmailHash,
        employerStudentIdHash
      );

      // Both students store their own diplomas
      await digitalIdentity.connect(student).StoreCredential(diplomaTypeHash, diplomaHash);
      await digitalIdentity.connect(student2).StoreCredential(diplomaTypeHash, student2DiplomaHash);

      // Both grant consent to same employer
      const expiryTimestamp = (await time.latest()) + 86400 * 30;
      await dataSharing.connect(student).GrantConsentAndReward(
        employer.address,
        diplomaTypeHash,
        expiryTimestamp
      );
      await dataSharing.connect(student2).GrantConsentAndReward(
        employer.address,
        diplomaTypeHash,
        expiryTimestamp
      );

      // Employer gets correct diploma for each student
      await dataSharing.connect(employer).AccessData(student.address, diplomaTypeHash);
      await dataSharing.connect(employer).AccessData(student2.address, diplomaTypeHash);

      // Verify hashes using staticCall
      const hash1 = await dataSharing.connect(employer).AccessData.staticCall(
        student.address,
        diplomaTypeHash
      );
      const hash2 = await dataSharing.connect(employer).AccessData.staticCall(
        student2.address,
        diplomaTypeHash
      );

      expect(hash1).to.equal(diplomaHash);
      expect(hash2).to.equal(student2DiplomaHash);
      expect(hash1).to.not.equal(hash2);
    });
  });

  describe("Query Functions Integration", function () {
    beforeEach(async function () {
      // Setup basic scenario
      await digitalIdentity.connect(student).RegisterUser(
        studentIdHash,
        studentEmailHash,
        studentStudentIdHash
      );
      await digitalIdentity.connect(employer).RegisterUser(
        employerIdHash,
        employerEmailHash,
        employerStudentIdHash
      );
      await digitalIdentity.connect(student).StoreCredential(diplomaTypeHash, diplomaHash);
    });

    it("Should query user registration through DataSharing", async function () {
      expect(await dataSharing.IsUserRegistered(student.address)).to.be.true;
      expect(await dataSharing.IsUserRegistered(university.address)).to.be.false;
    });

    it("Should query token balance through DataSharing", async function () {
      const expiryTimestamp = (await time.latest()) + 86400 * 30;
      await dataSharing.connect(student).GrantConsentAndReward(
        employer.address,
        diplomaTypeHash,
        expiryTimestamp
      );

      const balance = await dataSharing.GetTokenBalance(student.address);
      expect(balance).to.equal(ethers.parseEther("10"));
    });

    it("Should query consent expiry through DataSharing", async function () {
      const expiryTimestamp = (await time.latest()) + 86400 * 30;
      await dataSharing.connect(student).GrantConsentAndReward(
        employer.address,
        diplomaTypeHash,
        expiryTimestamp
      );

      const queriedExpiry = await dataSharing.GetConsentExpiry(
        student.address,
        employer.address,
        diplomaTypeHash
      );
      expect(queriedExpiry).to.equal(expiryTimestamp);
    });

    it("Should query access logs by owner", async function () {
      const expiryTimestamp = (await time.latest()) + 86400 * 30;
      await dataSharing.connect(student).GrantConsentAndReward(
        employer.address,
        diplomaTypeHash,
        expiryTimestamp
      );
      await dataSharing.connect(employer).AccessData(student.address, diplomaTypeHash);

      const logs = await dataSharing.getAccessLogsForOwner(student.address);
      expect(logs.length).to.equal(1);
      expect(logs[0].owner).to.equal(student.address);
      expect(logs[0].granted).to.be.true;
    });

    it("Should query access logs by requester", async function () {
      const expiryTimestamp = (await time.latest()) + 86400 * 30;
      await dataSharing.connect(student).GrantConsentAndReward(
        employer.address,
        diplomaTypeHash,
        expiryTimestamp
      );
      await dataSharing.connect(employer).AccessData(student.address, diplomaTypeHash);

      const logs = await dataSharing.getAccessLogsForRequester(employer.address);
      expect(logs.length).to.equal(1);
      expect(logs[0].requester).to.equal(employer.address);
      expect(logs[0].granted).to.be.true;
    });
  });

  describe("Token Economy Integration", function () {
    beforeEach(async function () {
      await digitalIdentity.connect(student).RegisterUser(
        studentIdHash,
        studentEmailHash,
        studentStudentIdHash
      );
      await digitalIdentity.connect(employer).RegisterUser(
        employerIdHash,
        employerEmailHash,
        employerStudentIdHash
      );
      await digitalIdentity.connect(student).StoreCredential(diplomaTypeHash, diplomaHash);
      await digitalIdentity.connect(student).StoreCredential(transcriptTypeHash, transcriptHash);
    });

    it("Should accumulate rewards for multiple consents", async function () {
      const expiryTimestamp = (await time.latest()) + 86400 * 30;

      // Grant consent for diploma
      await dataSharing.connect(student).GrantConsentAndReward(
        employer.address,
        diplomaTypeHash,
        expiryTimestamp
      );

      // Grant consent for transcript
      await dataSharing.connect(student).GrantConsentAndReward(
        employer.address,
        transcriptTypeHash,
        expiryTimestamp
      );

      // Student has 20 tokens total
      const expectedBalance = ethers.parseEther("20");
      expect(await rewardToken.balanceOf(student.address)).to.equal(expectedBalance);
    });

    it("Should allow students to transfer earned tokens", async function () {
      const expiryTimestamp = (await time.latest()) + 86400 * 30;
      await dataSharing.connect(student).GrantConsentAndReward(
        employer.address,
        diplomaTypeHash,
        expiryTimestamp
      );

      // Student transfers tokens to employer
      const transferAmount = ethers.parseEther("5");
      await rewardToken.connect(student).transfer(employer.address, transferAmount);

      expect(await rewardToken.balanceOf(student.address)).to.equal(ethers.parseEther("5"));
      expect(await rewardToken.balanceOf(employer.address)).to.equal(ethers.parseEther("5"));
    });
  });
});
