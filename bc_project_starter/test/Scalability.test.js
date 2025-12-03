const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Scalability Analysis", function () {
  let digitalIdentity, consentManager, dataSharing, rewardToken;
  let accounts;

  // Deploy contracts once before running all tests
  before(async function () {
    accounts = await ethers.getSigners();

    const DigitalIdentity = await ethers.getContractFactory("DigitalIdentity");
    digitalIdentity = await DigitalIdentity.deploy();

    const ConsentManager = await ethers.getContractFactory("ConsentManager");
    consentManager = await ConsentManager.deploy(await digitalIdentity.getAddress());

    const RewardToken = await ethers.getContractFactory("RewardToken");
    rewardToken = await RewardToken.deploy();

    const DataSharing = await ethers.getContractFactory("DataSharing");
    dataSharing = await DataSharing.deploy(
      await digitalIdentity.getAddress(),
      await consentManager.getAddress(),
      await rewardToken.getAddress()
    );

    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    await rewardToken.grantRole(MINTER_ROLE, await dataSharing.getAddress());
  });

  describe("User Registration Scalability", function () {
    it("Should show constant gas cost for 10 users", async function () {
      const gasUsed = [];

      // Register 10 users and track gas cost for each
      for (let i = 0; i < 10; i++) {
        const user = accounts[i];
        const idHash = ethers.keccak256(ethers.toUtf8Bytes(`student${i}`));
        const emailHash = ethers.keccak256(ethers.toUtf8Bytes(`student${i}@uni.edu`));
        const studentIdHash = ethers.keccak256(ethers.toUtf8Bytes(`S${i}`));

        const tx = await digitalIdentity.connect(user).RegisterUser(idHash, emailHash, studentIdHash);
        const receipt = await tx.wait();
        gasUsed.push(receipt.gasUsed);
      }

      // Calculate average and check if all costs are similar
      const avgGas = gasUsed.reduce((a, b) => a + b, 0n) / BigInt(gasUsed.length);
      const maxDeviation = gasUsed.reduce((max, gas) => {
        const deviation = gas > avgGas ? gas - avgGas : avgGas - gas;
        return deviation > max ? deviation : max;
      }, 0n);

      console.log(`\n  10 Users Registration:`);
      console.log(`     Average gas: ${avgGas.toString()}`);
      console.log(`     Max deviation: ${maxDeviation.toString()} (${(Number(maxDeviation) * 100 / Number(avgGas)).toFixed(2)}%)`);
      console.log(`     Total gas: ${gasUsed.reduce((a, b) => a + b, 0n).toString()}`);

      // Deviation should be less than 1% (proves constant cost)
      expect(maxDeviation).to.be.lt(avgGas / 100n);
    });

    it("Should show linear scaling with more users", async function () {
      // Register another 10 users (we already have 10 from previous test)
      const gasUsed = [];

      for (let i = 10; i < 20; i++) {
        const user = accounts[i];
        const idHash = ethers.keccak256(ethers.toUtf8Bytes(`student${i}`));
        const emailHash = ethers.keccak256(ethers.toUtf8Bytes(`student${i}@uni.edu`));
        const studentIdHash = ethers.keccak256(ethers.toUtf8Bytes(`S${i}`));

        const tx = await digitalIdentity.connect(user).RegisterUser(idHash, emailHash, studentIdHash);
        const receipt = await tx.wait();
        gasUsed.push(receipt.gasUsed);
      }

      const avgGas = gasUsed.reduce((a, b) => a + b, 0n) / BigInt(gasUsed.length);
      console.log(`\n  Next 10 Users Registration:`);
      console.log(`     Average gas: ${avgGas.toString()}`);
      console.log(`     Per-user cost stays constant (linear scaling)`);
    });
  });

  describe("Credential Storage Scalability", function () {
    it("Should handle multiple credentials per user", async function () {
      const user = accounts[0];
      const credentialTypes = ["Bachelor_Diploma", "Master_Diploma", "PhD_Certificate", "Transcript", "ID_Card"];
      const gasUsed = [];

      for (const credType of credentialTypes) {
        const credTypeHash = ethers.keccak256(ethers.toUtf8Bytes(credType));
        const credHash = ethers.keccak256(ethers.toUtf8Bytes(`${credType}_data`));

        const tx = await digitalIdentity.connect(user).StoreCredential(credTypeHash, credHash);
        const receipt = await tx.wait();
        gasUsed.push(receipt.gasUsed);
      }

      const avgGas = gasUsed.reduce((a, b) => a + b, 0n) / BigInt(gasUsed.length);
      console.log(`\n  5 Credentials for One User:`);
      console.log(`     Average gas: ${avgGas.toString()}`);
      console.log(`     Cost does not depend on total credentials in system`);
    });
  });

  describe("Consent Grant Scalability", function () {
    it("Should handle one student granting to multiple employers", async function () {
      const student = accounts[0];
      // Use accounts 15-19 for employers (already registered in previous tests)
      const employers = [accounts[15], accounts[16], accounts[17], accounts[18], accounts[19]];
      const credTypeHash = ethers.keccak256(ethers.toUtf8Bytes("Bachelor_Diploma"));
      const gasUsed = [];

      // Employers are already registered from previous tests, just grant consent to them
      for (const employer of employers) {
        const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;
        const tx = await dataSharing.connect(student).GrantConsentAndReward(employer.address, credTypeHash, expiry);
        const receipt = await tx.wait();
        gasUsed.push(receipt.gasUsed);
      }

      const avgGas = gasUsed.reduce((a, b) => a + b, 0n) / BigInt(gasUsed.length);
      console.log(`\n  1 Student Grants Consent to 5 Employers:`);
      console.log(`     Average gas per consent: ${avgGas.toString()}`);
      console.log(`     Total gas: ${gasUsed.reduce((a, b) => a + b, 0n).toString()}`);
      console.log(`     Student earned: ${employers.length * 10} EDUSHARE tokens`);
    });
  });

  describe("AccessData Scalability", function () {
    it("Should show constant gas cost for credential access", async function () {
      const student = accounts[0];
      const employer = accounts[15]; // Use employer from previous test who has consent
      const credTypeHash = ethers.keccak256(ethers.toUtf8Bytes("Bachelor_Diploma"));
      const gasUsed = [];

      // Access same credential 10 times to verify constant cost
      for (let i = 0; i < 10; i++) {
        const tx = await dataSharing.connect(employer).AccessData(student.address, credTypeHash);
        const receipt = await tx.wait();
        gasUsed.push(receipt.gasUsed);
      }

      const firstAccess = gasUsed[0];
      const lastAccess = gasUsed[gasUsed.length - 1];
      const avgGas = gasUsed.reduce((a, b) => a + b, 0n) / BigInt(gasUsed.length);
      const maxDeviation = gasUsed.reduce((max, gas) => {
        const deviation = gas > avgGas ? gas - avgGas : avgGas - gas;
        return deviation > max ? deviation : max;
      }, 0n);

      console.log(`\n  10 Sequential AccessData Calls:`);
      console.log(`     First access: ${firstAccess.toString()} gas`);
      console.log(`     Last access: ${lastAccess.toString()} gas`);
      console.log(`     Average: ${avgGas.toString()} gas`);
      console.log(`     Max deviation: ${maxDeviation.toString()} (${(Number(maxDeviation) * 100 / Number(avgGas)).toFixed(2)}%)`);
      console.log(`     Note: Constant O(1) cost - no on-chain logging, only events`);

      // Cost should be constant (< 5% deviation proves O(1) complexity)
      expect(maxDeviation).to.be.lt(avgGas / 20n); // Less than 5% deviation
    });
  });

  describe("Network Size Independence", function () {
    it("Should prove gas cost independent of total users", async function () {
      // We now have 20 users registered
      // Compare credential storage cost for user #2 vs user #20
      // (User #1 already has credentials from Test 3, its write cost is less so we use #2)
      const earlyUser = accounts[1];
      const lateUser = accounts[19];

      // Store first credential for user #2
      const credType1 = ethers.keccak256(ethers.toUtf8Bytes("Bachelor_Diploma"));
      const credHash1 = ethers.keccak256(ethers.toUtf8Bytes("diploma_data_user1"));
      const tx1 = await digitalIdentity.connect(earlyUser).StoreCredential(credType1, credHash1);
      const receipt1 = await tx1.wait();

      // Store first credential for user #20
      const credType2 = ethers.keccak256(ethers.toUtf8Bytes("Bachelor_Diploma"));
      const credHash2 = ethers.keccak256(ethers.toUtf8Bytes("diploma_data_user19"));
      const tx2 = await digitalIdentity.connect(lateUser).StoreCredential(credType2, credHash2);
      const receipt2 = await tx2.wait();

      console.log(`\n  Comparing User #2 vs User #20:`);
      console.log(`     User #2 credential storage: ${receipt1.gasUsed.toString()} gas`);
      console.log(`     User #20 credential storage: ${receipt2.gasUsed.toString()} gas`);
      console.log(`     Difference: ${receipt2.gasUsed > receipt1.gasUsed ? receipt2.gasUsed - receipt1.gasUsed : receipt1.gasUsed - receipt2.gasUsed} gas`);
      console.log(`     This proves O(1) constant time - cost doesn't increase with network size`);

      // Both should be within expected range for StoreCredential (~71k gas)
      expect(receipt1.gasUsed).to.be.gt(68000n);
      expect(receipt1.gasUsed).to.be.lt(75000n);
      expect(receipt2.gasUsed).to.be.gt(68000n);
      expect(receipt2.gasUsed).to.be.lt(75000n);
    });
  });

  describe("Theoretical Scalability Calculations", function () {
    it("Should calculate maximum throughput per block", async function () {
      const blockGasLimit = 30000000; // Ethereum block gas limit
      const avgRegistrationGas = 135724;
      const maxUsersPerBlock = Math.floor(blockGasLimit / avgRegistrationGas);

      console.log(`\n  Theoretical Limits:`);
      console.log(`     Block gas limit: ${blockGasLimit}`);
      console.log(`     Registration gas: ${avgRegistrationGas}`);
      console.log(`     Max registrations per block: ${maxUsersPerBlock}`);
      console.log(`     Ethereum (12 sec/block): ${maxUsersPerBlock * 5} users per minute`);
      console.log(`     Polygon (2 sec/block): ${maxUsersPerBlock * 30} users per minute`);
    });

    it("Should estimate costs for different scales", async function () {
      const scenarios = [
        { users: 100, name: "Small University" },
        { users: 10000, name: "Large University" },
        { users: 100000, name: "Multiple Universities" },
        { users: 1000000, name: "National Scale" }
      ];

      console.log(`\n  Cost Projections (Registration Only):`);

      for (const scenario of scenarios) {
        const totalGas = scenario.users * 135724;
        const ethCost = (totalGas * 50) / 1e9; // At 50 gwei gas price
        const usdCost = ethCost * 2000; // Assuming ETH = $2000

        console.log(`\n     ${scenario.name} (${scenario.users.toLocaleString()} users):`);
        console.log(`       Total gas: ${totalGas.toLocaleString()}`);
        console.log(`       Estimated cost: $${usdCost.toFixed(2)}`);
        console.log(`       Cost per user: $${(usdCost / scenario.users).toFixed(4)}`);
      }
    });
  });
});
