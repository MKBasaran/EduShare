const hre = require("hardhat");

async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("EduChain Platform - Complete Workflow Demo");
  console.log("=".repeat(70) + "\n");

  // Hardhat gives us 20 test accounts to work with. We'll use three of them:
  // one for deploying, one as a student, and one as an employer
  const [deployer, student, employer] = await hre.ethers.getSigners();

  console.log("Actors:");
  console.log("   Student:  ", student.address);
  console.log("   Employer: ", employer.address);
  console.log();

  // Let's deploy all the contracts. Order matters here because some contracts
  // need the addresses of others in their constructors.
  console.log("Deploying contracts...\n");

  const DigitalIdentity = await hre.ethers.getContractFactory("DigitalIdentity");
  const digitalIdentity = await DigitalIdentity.deploy();
  await digitalIdentity.waitForDeployment();
  console.log("   DigitalIdentity:", await digitalIdentity.getAddress());

  const ConsentManager = await hre.ethers.getContractFactory("ConsentManager");
  const consentManager = await ConsentManager.deploy(await digitalIdentity.getAddress());
  await consentManager.waitForDeployment();
  console.log("   ConsentManager: ", await consentManager.getAddress());

  const RewardToken = await hre.ethers.getContractFactory("RewardToken");
  const rewardToken = await RewardToken.deploy();
  await rewardToken.waitForDeployment();
  console.log("   RewardToken:    ", await rewardToken.getAddress());

  const DataSharing = await hre.ethers.getContractFactory("DataSharing");
  const dataSharing = await DataSharing.deploy(
    await digitalIdentity.getAddress(),
    await consentManager.getAddress(),
    await rewardToken.getAddress()
  );
  await dataSharing.waitForDeployment();
  console.log("   DataSharing:    ", await dataSharing.getAddress());

  // DataSharing needs permission to mint reward tokens
  const MINTER_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("MINTER_ROLE"));
  await rewardToken.grantRole(MINTER_ROLE, await dataSharing.getAddress());
  console.log("   MINTER_ROLE granted to DataSharing\n");

  // Step 1: The student needs to register first before they can do anything
  // We hash their personal info so no plaintext data goes on chain
  console.log("=".repeat(70));
  console.log("STEP 1: Student Registers");
  console.log("=".repeat(70));

  const studentIdHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("STUDENT12345"));
  const studentEmailHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("alice@university.edu"));
  const studentStudentIdHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("S2024001"));

  const tx1 = await digitalIdentity.connect(student).RegisterUser(
    studentIdHash,
    studentEmailHash,
    studentStudentIdHash
  );
  await tx1.wait();

  console.log("Student registered!");
  console.log("   Address:", student.address);
  console.log("   ID Hash:", studentIdHash);
  console.log("   Registered:", await digitalIdentity.IsRegistered(student.address));
  console.log();

  // Step 2: Now the employer also needs to register
  console.log("=".repeat(70));
  console.log("STEP 2: Employer Registers");
  console.log("=".repeat(70));

  const employerIdHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("EMPLOYER789"));
  const employerEmailHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("hr@techcorp.com"));
  const employerOrgIdHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("ORG456"));

  const tx2 = await digitalIdentity.connect(employer).RegisterUser(
    employerIdHash,
    employerEmailHash,
    employerOrgIdHash
  );
  await tx2.wait();

  console.log("Employer registered!");
  console.log("   Address:", employer.address);
  console.log("   ID Hash:", employerIdHash);
  console.log("   Registered:", await digitalIdentity.IsRegistered(employer.address));
  console.log();

  // Step 3: Student stores their diploma. In reality they'd have a real diploma file
  // and we'd hash that. Here we're just using a fake hash for demonstration.
  console.log("=".repeat(70));
  console.log("STEP 3: Student Stores Bachelor's Diploma");
  console.log("=".repeat(70));

  const credentialType = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Bachelor_Diploma"));
  const diplomaHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("DIPLOMA_CONTENT_HASH_ABC123"));

  const tx3 = await digitalIdentity.connect(student).StoreCredential(
    credentialType,
    diplomaHash
  );
  await tx3.wait();

  console.log("Credential stored!");
  console.log("   Type:", "Bachelor_Diploma");
  console.log("   Type Hash:", credentialType);
  console.log("   Diploma Hash:", diplomaHash);
  console.log("   Exists:", await digitalIdentity.CredentialExists(student.address, credentialType));
  console.log();

  // Step 4: Let's check the student's token balance before they grant any consent
  // Should be zero since they haven't done anything yet
  console.log("=".repeat(70));
  console.log("STEP 4: Check Initial Token Balances");
  console.log("=".repeat(70));

  const initialBalance = await rewardToken.balanceOf(student.address);
  console.log("   Student token balance:", hre.ethers.formatEther(initialBalance), "EDUSHARE");
  console.log();

  // Step 5: Here's where it gets interesting - student grants consent to the employer
  // to access their diploma. This consent expires after 30 days. The student gets
  // rewarded with tokens for sharing their data.
  console.log("=".repeat(70));
  console.log("STEP 5: Student Grants 30-Day Consent to Employer");
  console.log("=".repeat(70));

  const currentTime = Math.floor(Date.now() / 1000);
  const expiry = currentTime + (30 * 24 * 60 * 60);

  console.log("   Granting consent...");
  console.log("   Expiry:", new Date(expiry * 1000).toISOString());

  const tx4 = await dataSharing.connect(student).GrantConsentAndReward(
    employer.address,
    credentialType,
    expiry
  );
  await tx4.wait();

  console.log("Consent granted!");
  console.log("   From:", student.address);
  console.log("   To:", employer.address);
  console.log("   Credential:", "Bachelor_Diploma");

  const newBalance = await rewardToken.balanceOf(student.address);
  console.log("   Student token balance:", hre.ethers.formatEther(newBalance), "EDUSHARE");
  console.log("   Tokens earned:", hre.ethers.formatEther(newBalance - initialBalance), "EDUSHARE");
  console.log();

  // Step 6: Now the employer can actually access the diploma hash from the blockchain
  // First we check if they have permission, then we retrieve the hash
  console.log("=".repeat(70));
  console.log("STEP 6: Employer Accesses Student's Diploma");
  console.log("=".repeat(70));

  console.log("   Checking consent validity...");
  const canAccess = await dataSharing.CanAccess(student.address, employer.address, credentialType);
  console.log("   Can employer access? ", canAccess ? "YES" : "NO");

  if (canAccess) {
    console.log("   Accessing credential...");
    const tx5 = await dataSharing.connect(employer).AccessData(student.address, credentialType);
    const receipt = await tx5.wait();

    // Look through the transaction logs to find the AccessGranted event
    const accessEvent = receipt.logs.find(log => {
      try {
        const parsed = dataSharing.interface.parseLog(log);
        return parsed.name === "AccessGranted";
      } catch {
        return false;
      }
    });

    if (accessEvent) {
      const parsed = dataSharing.interface.parseLog(accessEvent);
      console.log("Access granted!");
      console.log("   Credential Hash Retrieved:", parsed.args.credentialHash);
      console.log("   Matches Original?", parsed.args.credentialHash === diplomaHash ? "YES" : "NO");
    }
  }
  console.log();

  // Step 7: Student changes their mind and revokes consent. The employer loses access
  // but the student keeps the tokens they already earned
  console.log("=".repeat(70));
  console.log("STEP 7: Student Revokes Consent");
  console.log("=".repeat(70));

  const tx6 = await dataSharing.connect(student).RevokeConsentWrapper(
    employer.address,
    credentialType
  );
  await tx6.wait();

  console.log("Consent revoked!");
  console.log("   From:", student.address);
  console.log("   To:", employer.address);

  const finalBalance = await rewardToken.balanceOf(student.address);
  console.log("   Student token balance:", hre.ethers.formatEther(finalBalance), "EDUSHARE");
  console.log("   Tokens reclaimed?", "NO (student keeps tokens)");
  console.log();

  // Step 8: Let's verify that the employer really can't access anymore
  console.log("=".repeat(70));
  console.log("STEP 8: Employer Tries to Access After Revocation");
  console.log("=".repeat(70));

  const stillCanAccess = await dataSharing.CanAccess(student.address, employer.address, credentialType);
  console.log("   Can employer access?", stillCanAccess ? "YES" : "NO");

  if (!stillCanAccess) {
    console.log("   Attempting access anyway...");
    try {
      await dataSharing.connect(employer).AccessData(student.address, credentialType);
      console.log("   ERROR: Access should have been denied!");
    } catch (error) {
      console.log("   Access correctly denied!");
      console.log("   Error:", error.message.split("\n")[0]);
    }
  }
  console.log();

  // All done. Lets print a summary of what happened
  console.log("=".repeat(70));
  console.log("Summary");
  console.log("=".repeat(70));
  console.log("All steps completed successfully!");
  console.log();
  console.log("Workflow:");
  console.log("  1. Student registered");
  console.log("  2. Employer registered");
  console.log("  3. Student stored credential");
  console.log("  4. Student granted consent");
  console.log("  5. Student earned tokens (10 EDUSHARE)");
  console.log("  6. Employer accessed data");
  console.log("  7. Student revoked consent");
  console.log("  8. Employer blocked");
  console.log();
  console.log("Final Balances:");
  console.log("  Student:", hre.ethers.formatEther(await rewardToken.balanceOf(student.address)), "EDUSHARE");
  console.log("  Employer:", hre.ethers.formatEther(await rewardToken.balanceOf(employer.address)), "EDUSHARE");
  console.log();
  console.log("=".repeat(70));
  console.log("Demo complete!");
  console.log("=".repeat(70) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
