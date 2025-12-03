const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("=".repeat(60));
  console.log("Starting EduChain Platform Deployment");
  console.log("=".repeat(60));
  console.log();

  // Grab the first account from Hardhat's test accounts to use as deployer
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH");
  console.log();

  // First we need to deploy DigitalIdentity since other contracts depend on it
  console.log("Step 1: Deploying DigitalIdentity...");
  const DigitalIdentity = await hre.ethers.getContractFactory("DigitalIdentity");
  const digitalIdentity = await DigitalIdentity.deploy();
  await digitalIdentity.waitForDeployment();
  const digitalIdentityAddress = await digitalIdentity.getAddress();
  console.log("DigitalIdentity deployed to:", digitalIdentityAddress);
  console.log();

  // ConsentManager needs DigitalIdentity address in its constructor
  console.log("Step 2: Deploying ConsentManager...");
  const ConsentManager = await hre.ethers.getContractFactory("ConsentManager");
  const consentManager = await ConsentManager.deploy(digitalIdentityAddress);
  await consentManager.waitForDeployment();
  const consentManagerAddress = await consentManager.getAddress();
  console.log("ConsentManager deployed to:", consentManagerAddress);
  console.log();

  // Deploy the token contract that will reward users for sharing data
  console.log("Step 3: Deploying RewardToken...");
  const RewardToken = await hre.ethers.getContractFactory("RewardToken");
  const rewardToken = await RewardToken.deploy();
  await rewardToken.waitForDeployment();
  const rewardTokenAddress = await rewardToken.getAddress();
  console.log("RewardToken deployed to:", rewardTokenAddress);
  console.log();

  // DataSharing is the main contract that ties everything together
  // It needs addresses of all three other contracts
  console.log("Step 4: Deploying DataSharing...");
  const DataSharing = await hre.ethers.getContractFactory("DataSharing");
  const dataSharing = await DataSharing.deploy(
    digitalIdentityAddress,
    consentManagerAddress,
    rewardTokenAddress
  );
  await dataSharing.waitForDeployment();
  const dataSharingAddress = await dataSharing.getAddress();
  console.log("DataSharing deployed to:", dataSharingAddress);
  console.log();

  // Important: DataSharing needs permission to mint tokens when users grant consent
  // We give it the MINTER_ROLE so it can actually reward people
  console.log("Step 5: Granting MINTER_ROLE to DataSharing...");
  const MINTER_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("MINTER_ROLE"));
  const grantRoleTx = await rewardToken.grantRole(MINTER_ROLE, dataSharingAddress);
  await grantRoleTx.wait();
  console.log("MINTER_ROLE granted to DataSharing");
  console.log();

  console.log("=".repeat(60));
  console.log("Deployment Complete!");
  console.log("=".repeat(60));
  console.log();
  console.log("Contract Addresses:");
  console.log("-".repeat(60));
  console.log("DigitalIdentity:  ", digitalIdentityAddress);
  console.log("ConsentManager:   ", consentManagerAddress);
  console.log("RewardToken:      ", rewardTokenAddress);
  console.log("DataSharing:      ", dataSharingAddress);
  console.log("-".repeat(60));
  console.log();

  // Save all the addresses to a JSON file so we can reference them later
  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      DigitalIdentity: digitalIdentityAddress,
      ConsentManager: consentManagerAddress,
      RewardToken: rewardTokenAddress,
      DataSharing: dataSharingAddress,
    },
  };

  fs.writeFileSync(
    "deployment-addresses.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("Deployment addresses saved to deployment-addresses.json");
  console.log();

  // Quick sanity check to make sure DataSharing actually got the minting role
  console.log("Verifying setup...");
  const hasRole = await rewardToken.hasRole(MINTER_ROLE, dataSharingAddress);
  console.log("DataSharing has MINTER_ROLE:", hasRole);

  if (hasRole) {
    console.log("All setup complete and verified!");
  } else {
    console.log("Warning: MINTER_ROLE verification failed");
  }

  console.log();
  console.log("=".repeat(60));
  console.log("Next Steps:");
  console.log("1. Run tests: npm test");
  console.log("2. Interact with contracts using the deployment addresses");
  console.log("3. Check gas costs in gas-report.txt after running tests");
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:");
    console.error(error);
    process.exit(1);
  });
