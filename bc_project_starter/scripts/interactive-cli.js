const hre = require("hardhat");
const readline = require("readline");
const fs = require("fs");
const path = require("path");

let digitalIdentity, consentManager, dataSharing, rewardToken;
let accounts = [];
let currentUser = null;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

async function deploy() {
  console.log("\nDeploying contracts...");

  accounts = await hre.ethers.getSigners();

  const DigitalIdentity = await hre.ethers.getContractFactory("DigitalIdentity");
  digitalIdentity = await DigitalIdentity.deploy();
  await digitalIdentity.waitForDeployment();

  const ConsentManager = await hre.ethers.getContractFactory("ConsentManager");
  consentManager = await ConsentManager.deploy(await digitalIdentity.getAddress());
  await consentManager.waitForDeployment();

  const RewardToken = await hre.ethers.getContractFactory("RewardToken");
  rewardToken = await RewardToken.deploy();
  await rewardToken.waitForDeployment();

  const DataSharing = await hre.ethers.getContractFactory("DataSharing");
  dataSharing = await DataSharing.deploy(
    await digitalIdentity.getAddress(),
    await consentManager.getAddress(),
    await rewardToken.getAddress()
  );
  await dataSharing.waitForDeployment();

  const MINTER_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("MINTER_ROLE"));
  await rewardToken.grantRole(MINTER_ROLE, await dataSharing.getAddress());

  console.log("All contracts deployed!");
  console.log("   DigitalIdentity:", await digitalIdentity.getAddress());
  console.log("   DataSharing:", await dataSharing.getAddress());
}

async function showMenu() {
  console.log("\n" + "=".repeat(60));
  console.log("EduChain Interactive CLI");
  console.log("=".repeat(60));
  if (currentUser) {
    const balance = await rewardToken.balanceOf(currentUser.address);
    console.log(`Current User: ${currentUser.address.slice(0, 10)}...`);
    console.log(`Tokens: ${hre.ethers.formatEther(balance)} EDUSHARE`);
  } else {
    console.log("No user selected");
  }
  console.log("=".repeat(60));
  console.log("\n1. Select Account");
  console.log("2. Register User");
  console.log("3. Store Credential");
  console.log("4. Grant Consent");
  console.log("5. Access Credential (as requester)");
  console.log("6. Revoke Consent");
  console.log("7. View Token Balance");
  console.log("8. List Accounts");
  console.log("9. Exit");
  console.log();
}

async function selectAccount() {
  console.log("\nAvailable Accounts:");
  for (let i = 0; i < Math.min(5, accounts.length); i++) {
    const isRegistered = await digitalIdentity.IsRegistered(accounts[i].address);
    const balance = await rewardToken.balanceOf(accounts[i].address);
    console.log(`${i + 1}. ${accounts[i].address} ${isRegistered ? "[Registered]" : "[Not Registered]"} (${hre.ethers.formatEther(balance)} EDUSHARE)`);
  }

  const choice = await question("\nSelect account number: ");
  const index = parseInt(choice) - 1;

  if (index >= 0 && index < accounts.length) {
    currentUser = accounts[index];
    console.log(`Selected: ${currentUser.address}`);
  } else {
    console.log("Invalid selection");
  }
}

async function registerUser() {
  if (!currentUser) {
    console.log("Please select an account first!");
    return;
  }

  const name = await question("Enter name: ");
  const email = await question("Enter email: ");
  const studentId = await question("Enter student/org ID: ");

  const idHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(studentId));
  const emailHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(email));
  const studentIdHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(studentId + "_HASH"));

  try {
    const tx = await digitalIdentity.connect(currentUser).RegisterUser(
      idHash,
      emailHash,
      studentIdHash
    );
    await tx.wait();
    console.log(`${name} registered successfully!`);
  } catch (error) {
    console.log("Error:", error.message.split("\n")[0]);
  }
}

async function storeCredential() {
  if (!currentUser) {
    console.log("Please select an account first!");
    return;
  }

  console.log("\nCreating diploma file...");

  const name = await question("Student name: ");
  const major = await question("Major: ");
  const gpa = await question("GPA: ");

  const diploma = {
    credentialType: "Bachelor_Diploma",
    studentInfo: { name },
    degree: {
      type: "Bachelor of Science",
      major,
      university: "Maastricht University",
      gpa
    },
    issuer: {
      name: "Maastricht University Registrar",
      issuedDate: new Date().toISOString()
    }
  };

  const dataDir = path.join(__dirname, "..", "student_data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const filename = `diploma_${currentUser.address.slice(2, 10)}.json`;
  const filepath = path.join(dataDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(diploma, null, 2));

  const content = fs.readFileSync(filepath, "utf8");
  const credentialHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(content));
  const credentialType = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Bachelor_Diploma"));

  try {
    const tx = await digitalIdentity.connect(currentUser).StoreCredential(
      credentialType,
      credentialHash
    );
    await tx.wait();
    console.log(`Credential stored!`);
    console.log(`   File: ${filepath}`);
    console.log(`   Hash: ${credentialHash}`);
  } catch (error) {
    console.log("Error:", error.message.split("\n")[0]);
  }
}

async function grantConsent() {
  if (!currentUser) {
    console.log("Please select an account first!");
    return;
  }

  console.log("\nAvailable Accounts to Grant Consent:");
  for (let i = 0; i < Math.min(5, accounts.length); i++) {
    if (accounts[i].address !== currentUser.address) {
      const isRegistered = await digitalIdentity.IsRegistered(accounts[i].address);
      console.log(`${i + 1}. ${accounts[i].address.slice(0, 20)}... ${isRegistered ? "[Registered]" : "[Not Registered]"}`);
    }
  }

  const choice = await question("\nGrant consent to account number: ");
  const index = parseInt(choice) - 1;
  const requester = accounts[index];

  if (!requester) {
    console.log("Invalid selection");
    return;
  }

  const days = await question("Duration in days (1-365): ");
  const expiry = Math.floor(Date.now() / 1000) + (parseInt(days) * 24 * 60 * 60);
  const credentialType = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Bachelor_Diploma"));

  try {
    const tx = await dataSharing.connect(currentUser).GrantConsentAndReward(
      requester.address,
      credentialType,
      expiry
    );
    await tx.wait();

    const balance = await rewardToken.balanceOf(currentUser.address);
    console.log(`Consent granted for ${days} days!`);
    console.log(`   You earned 10 EDUSHARE tokens!`);
    console.log(`   New balance: ${hre.ethers.formatEther(balance)} EDUSHARE`);
  } catch (error) {
    console.log("Error:", error.message.split("\n")[0]);
  }
}

async function accessCredential() {
  if (!currentUser) {
    console.log("Please select an account first!");
    return;
  }

  console.log("\nWhose credential do you want to access?");
  for (let i = 0; i < Math.min(5, accounts.length); i++) {
    if (accounts[i].address !== currentUser.address) {
      console.log(`${i + 1}. ${accounts[i].address.slice(0, 20)}...`);
    }
  }

  const choice = await question("\nAccount number: ");
  const index = parseInt(choice) - 1;
  const owner = accounts[index];

  if (!owner) {
    console.log("Invalid selection");
    return;
  }

  const credentialType = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Bachelor_Diploma"));

  try {
    const canAccess = await dataSharing.CanAccess(owner.address, currentUser.address, credentialType);

    if (!canAccess) {
      console.log("You don't have permission to access this credential!");
      console.log("   Ask the owner to grant you consent first.");
      return;
    }

    const tx = await dataSharing.connect(currentUser).AccessData(owner.address, credentialType);
    const receipt = await tx.wait();

    // Look for the AccessGranted event in the transaction logs
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
      console.log(`Access granted!`);
      console.log(`   Credential Hash: ${parsed.args.credentialHash}`);
      console.log(`   You can now verify the actual diploma file using this hash.`);
    }
  } catch (error) {
    console.log("Error:", error.message.split("\n")[0]);
  }
}

async function revokeConsent() {
  if (!currentUser) {
    console.log("Please select an account first!");
    return;
  }

  console.log("\nRevoke consent from:");
  for (let i = 0; i < Math.min(5, accounts.length); i++) {
    if (accounts[i].address !== currentUser.address) {
      console.log(`${i + 1}. ${accounts[i].address.slice(0, 20)}...`);
    }
  }

  const choice = await question("\nAccount number: ");
  const index = parseInt(choice) - 1;
  const requester = accounts[index];

  if (!requester) {
    console.log("Invalid selection");
    return;
  }

  const credentialType = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Bachelor_Diploma"));

  try {
    const tx = await dataSharing.connect(currentUser).RevokeConsentWrapper(
      requester.address,
      credentialType
    );
    await tx.wait();

    console.log(`Consent revoked!`);
    console.log(`   They can no longer access your credential.`);
    console.log(`   You keep your tokens!`);
  } catch (error) {
    console.log("Error:", error.message.split("\n")[0]);
  }
}

async function viewBalance() {
  if (!currentUser) {
    console.log("Please select an account first!");
    return;
  }

  const balance = await rewardToken.balanceOf(currentUser.address);
  console.log(`\nToken Balance: ${hre.ethers.formatEther(balance)} EDUSHARE`);
}

async function listAccounts() {
  console.log("\nAll Accounts:");
  for (let i = 0; i < Math.min(5, accounts.length); i++) {
    const isRegistered = await digitalIdentity.IsRegistered(accounts[i].address);
    const balance = await rewardToken.balanceOf(accounts[i].address);
    const status = isRegistered ? "Registered" : "Not Registered";
    console.log(`${i + 1}. ${accounts[i].address}`);
    console.log(`   Status: ${status}`);
    console.log(`   Tokens: ${hre.ethers.formatEther(balance)} EDUSHARE`);
  }
}

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("EduChain Platform - Interactive CLI");
  console.log("=".repeat(60));
  console.log("\nStarting...\n");

  await deploy();

  let running = true;

  while (running) {
    await showMenu();
    const choice = await question("Select option (1-9): ");

    switch (choice) {
      case "1":
        await selectAccount();
        break;
      case "2":
        await registerUser();
        break;
      case "3":
        await storeCredential();
        break;
      case "4":
        await grantConsent();
        break;
      case "5":
        await accessCredential();
        break;
      case "6":
        await revokeConsent();
        break;
      case "7":
        await viewBalance();
        break;
      case "8":
        await listAccounts();
        break;
      case "9":
        console.log("\nGoodbye!");
        running = false;
        break;
      default:
        console.log("Invalid option");
    }
  }

  rl.close();
  process.exit(0);
}

main().catch(console.error);
