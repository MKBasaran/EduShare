# Step 3: Implementation Guide

## Overview

This guide helps you set up your development environment and provides a roadmap for implementing the smart contracts designed in Step 2B.


---

## Prerequisites

### Required Software

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | v18+ | JavaScript runtime |
| npm | v9+ | Package manager |
| Git | Latest | Version control |
| VSCode | Latest | Code editor (recommended) |

---

## VSCode Setup for Solidity Development

### Recommended Extensions

1. **Solidity** (by Juan Blanco)
   - Syntax highlighting
   - Code completion
   - Linting
   - Install: `ext install JuanBlanco.solidity`

2. **Hardhat Solidity** (by NomicFoundation)
   - Enhanced Hardhat integration
   - Install: `ext install NomicFoundation.hardhat-solidity`

3. **Prettier - Code formatter**
   - Consistent code formatting
   - Install: `ext install esbenp.prettier-vscode`

4. **Solidity Visual Developer** (Optional)
   - UML diagram generation
   - Security analysis
   - Install: `ext install tintinweb.solidity-visual-auditor`

---

## Project Setup

### Step 1: Initialize Hardhat Project

```bash
# Create project directory
mkdir educhain-platform
cd educhain-platform

# Initialize npm project
npm init -y

# Install Hardhat
npm install --save-dev hardhat

# Create Hardhat project
npx hardhat init
# Select: "Create a TypeScript project" or "Create a JavaScript project"
```

---

### Step 2: Install Dependencies

```bash
# OpenZeppelin contracts (for Ownable, ERC20, ReentrancyGuard)
npm install --save-dev @openzeppelin/contracts

# Hardhat plugins
npm install --save-dev @nomicfoundation/hardhat-toolbox

# Testing utilities (if not included)
npm install --save-dev @nomicfoundation/hardhat-chai-matchers chai

# TypeScript (if using TS)
npm install --save-dev typescript @types/node @types/mocha @types/chai
```

---

### Step 3: Configure Hardhat

Edit `hardhat.config.js` (or `.ts`):

```javascript
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 31337
    }
    // Add testnet configs later if needed
  },
  gasReporter: {
    enabled: true,
    currency: "USD"
  }
};
```

---

## Project Structure

```
educhain-platform/
├── contracts/
│   ├── DigitalIdentity.sol
│   ├── ConsentManager.sol
│   ├── DataSharing.sol
│   ├── RewardToken.sol
│   └── interfaces/
│       ├── IDigitalIdentity.sol
│       ├── IConsentManager.sol
│       └── IRewardToken.sol
├── test/
│   ├── DigitalIdentity.test.js
│   ├── ConsentManager.test.js
│   ├── RewardToken.test.js
│   ├── DataSharing.audit.test.js
│   ├── Integration.test.js
│   └── Scalability.test.js
├── scripts/
│   ├── deploy.js
│   └── interact.js
├── hardhat.config.js
├── package.json
└── README.md
```

---

## Implementation Roadmap

### Phase 1: Core Contracts 

#### Contract 1: DigitalIdentity.sol

**Implementation Order**:
1. Define structs (User, Credential)
2. Define state variables (mappings)
3. Implement RegisterUser()
4. Implement StoreCredential()
5. Implement view functions (GetCredentialHash, IsRegistered)
6. Define events
7. Add NatSpec comments

**Key Points**:
- Use `bytes32` for all hashes
- Use `mapping` for storage
- Validate inputs (`require` statements)
- Emit events for all state changes

---

#### Contract 2: RewardToken.sol

**Implementation**:
- Inherit from OpenZeppelin ERC20
- Add minting capability (only DataSharing can mint)
- Use AccessControl for minter role

**Example skeleton**:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract RewardToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor() ERC20("EduShareToken", "EDUSHARE") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }
}
```

---

#### Contract 3: ConsentManager.sol

**Implementation Order**:
1. Define Consent struct
2. Define nested mapping
3. Implement SetConsent()
4. Implement RevokeConsent()
5. Implement CheckConsent()
6. Define events
7. Add constructor to accept DigitalIdentity address

**Key Points**:
- Store DigitalIdentity address as `immutable`
- Call DigitalIdentity.IsRegistered() for validation
- Use `delete` for revocation (gas refund)
- Check expiry: `block.timestamp < consent.expiry`

---

#### Contract 4: DataSharing.sol

**Implementation Order**:
1. Define state variables (contract references)
2. Implement GrantConsentAndReward()
3. Implement RevokeConsentWrapper()
4. Implement AccessData()
5. Implement logging functions
6. Define events
7. Add ReentrancyGuard

**Key Points**:
- Use Checks-Effects-Interactions pattern
- Call ConsentManager and DigitalIdentity via interfaces
- Mint tokens AFTER consent is granted
- Emit events for all access attempts

---

### Phase 2: Interfaces 

Create interface files for contract communication:

**IDigitalIdentity.sol**:
```solidity
interface IDigitalIdentity {
    function IsRegistered(address user) external view returns (bool);
    function GetCredentialHash(address owner, bytes32 credentialTypeHash)
        external view returns (bytes32);
}
```

**IConsentManager.sol**:
```solidity
interface IConsentManager {
    function SetConsent(address requester, bytes32 credentialTypeHash, uint256 expiry) external;
    function RevokeConsent(address requester, bytes32 credentialTypeHash) external;
    function CheckConsent(address owner, address requester, bytes32 credentialTypeHash)
        external view returns (bool);
}
```

---

### Phase 3: Testing 

#### Test Structure (One File Per Contract)

**DigitalIdentity.test.js**:
```javascript
describe("DigitalIdentity", function () {
  describe("RegisterUser", function () {
    it("Should register a new user", async function () {});
    it("Should prevent duplicate registration", async function () {});
    it("Should emit IdentityRegistered event", async function () {});
  });

  describe("StoreCredential", function () {
    it("Should store credential hash", async function () {});
    it("Should revert if user not registered", async function () {});
    it("Should allow credential updates", async function () {});
  });

  // ... more tests
});
```

---

**ConsentManager.test.js**:
```javascript
describe("ConsentManager", function () {
  describe("SetConsent", function () {
    it("Should grant consent with valid parameters", async function () {});
    it("Should revert if requester not registered", async function () {});
    it("Should revert if expiry is in past", async function () {});
    it("Should revert if expiry > 365 days", async function () {});
  });

  describe("RevokeConsent", function () {
    it("Should revoke existing consent", async function () {});
    it("Should revert if consent doesn't exist", async function () {});
  });

  describe("CheckConsent", function () {
    it("Should return true for valid consent", async function () {});
    it("Should return false for expired consent", async function () {});
    it("Should return false for revoked consent", async function () {});
  });
});
```

---

**DataSharing.test.js**:
```javascript
describe("DataSharing", function () {
  describe("GrantConsentAndReward", function () {
    it("Should grant consent and mint tokens", async function () {});
    it("Should emit ConsentGranted and TokensRewarded", async function () {});
  });

  describe("AccessData", function () {
    it("Should return credential hash with valid consent", async function () {});
    it("Should revert if consent expired", async function () {});
    it("Should revert if consent revoked", async function () {});
    it("Should revert if no consent exists", async function () {});
    it("Should emit AccessGranted event", async function () {});
  });

  // Gas cost tests
  describe("Gas Costs", function () {
    it("Should measure AccessData gas cost", async function () {});
  });
});
```

---

#### Integration Tests

**Integration.test.js**:
```javascript
describe("Full Workflow Integration", function () {
  it("Should complete full student-employer flow", async function () {
    // 1. Student registers
    // 2. Employer registers
    // 3. Student stores credential
    // 4. Student grants consent
    // 5. Employer accesses credential
    // 6. Verify token balance
    // 7. Student revokes consent
    // 8. Employer access fails
  });
});
```

---

#### Scalability Tests

**Scalability.test.js**:
```javascript
describe("Scalability Analysis", function () {
  describe("User Registration Scalability", function () {
    it("Should show constant gas cost for 10 users", async function () {});
    it("Should show linear scaling with more users", async function () {});
  });

  describe("Credential Storage Scalability", function () {
    it("Should handle multiple credentials per user", async function () {});
  });

  describe("Consent Grant Scalability", function () {
    it("Should handle one student granting to multiple employers", async function () {});
  });

  describe("AccessData Scalability", function () {
    it("Should measure gas growth as audit log grows", async function () {});
  });

  describe("Network Size Independence", function () {
    it("Should prove gas cost independent of total users", async function () {});
  });

  describe("Theoretical Scalability Calculations", function () {
    it("Should calculate maximum throughput per block", async function () {});
    it("Should estimate costs for different scales", async function () {});
  });
});
```

---

### Phase 4: Deployment 

**Deploy Script** (`scripts/deploy.js`):

```javascript
async function main() {
  // 1. Deploy DigitalIdentity
  const DigitalIdentity = await ethers.getContractFactory("DigitalIdentity");
  const identity = await DigitalIdentity.deploy();
  await identity.waitForDeployment();
  console.log("DigitalIdentity deployed to:", await identity.getAddress());

  // 2. Deploy ConsentManager (pass DigitalIdentity address)
  const ConsentManager = await ethers.getContractFactory("ConsentManager");
  const consent = await ConsentManager.deploy(await identity.getAddress());
  await consent.waitForDeployment();
  console.log("ConsentManager deployed to:", await consent.getAddress());

  // 3. Deploy RewardToken
  const RewardToken = await ethers.getContractFactory("RewardToken");
  const token = await RewardToken.deploy();
  await token.waitForDeployment();
  console.log("RewardToken deployed to:", await token.getAddress());

  // 4. Deploy DataSharing (pass all addresses)
  const DataSharing = await ethers.getContractFactory("DataSharing");
  const dataSharing = await DataSharing.deploy(
    await identity.getAddress(),
    await consent.getAddress(),
    await token.getAddress()
  );
  await dataSharing.waitForDeployment();
  console.log("DataSharing deployed to:", await dataSharing.getAddress());

  // 5. Grant MINTER_ROLE to DataSharing
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  await token.grantRole(MINTER_ROLE, await dataSharing.getAddress());
  console.log("MINTER_ROLE granted to DataSharing");

  console.log("\nDeployment complete!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

Run deployment:
```bash
npx hardhat run scripts/deploy.js --network hardhat
```

---

### Phase 5: Gas Optimization & Reporting 

**Enable Gas Reporter** in `hardhat.config.js`:
```javascript
gasReporter: {
  enabled: true,
  currency: "USD",
  outputFile: "gas-report.txt",
  noColors: true
}
```

**Run tests with gas reporting**:
```bash
npx hardhat test
```

**Create Gas Cost Table** (for report):

| Function | Gas Used | USD Cost (at 50 gwei) |
|----------|----------|------------------------|
| DigitalIdentity.RegisterUser | ~80,000 | $X.XX |
| DigitalIdentity.StoreCredential | ~60,000 | $X.XX |
| ConsentManager.SetConsent | ~70,000 | $X.XX |
| ConsentManager.RevokeConsent | ~30,000 | $X.XX |
| DataSharing.GrantConsentAndReward | ~120,000 | $X.XX |
| DataSharing.AccessData | ~50,000 | $X.XX |
| **Contract Deployment (all 4)** | ~2,000,000 | $X.XX |

---

## Testing Checklist

### Unit Tests

- [ ] DigitalIdentity: RegisterUser (success, duplicates, events)
- [ ] DigitalIdentity: StoreCredential (success, unregistered user, updates)
- [ ] DigitalIdentity: View functions (GetCredentialHash, IsRegistered)
- [ ] ConsentManager: SetConsent (success, invalid expiry, unregistered requester)
- [ ] ConsentManager: RevokeConsent (success, non-existent consent)
- [ ] ConsentManager: CheckConsent (valid, expired, revoked)
- [ ] DataSharing: GrantConsentAndReward (consent + tokens)
- [ ] DataSharing: AccessData (success, expired, revoked, no consent)
- [ ] DataSharing: Event emissions (AccessGranted, AccessDenied)
- [ ] RewardToken: Minting (only MINTER_ROLE can mint)

### Integration Tests

- [ ] Full workflow: Register → Store → Grant → Access → Revoke
- [ ] Token balance checks after consent grants
- [ ] Cross-contract calls work correctly
- [ ] Event filtering and querying

### Edge Cases

- [ ] Accessing non-existent credential
- [ ] Granting consent to non-existent requester
- [ ] Revoking already-revoked consent
- [ ] Accessing on exact expiry timestamp (boundary test)
- [ ] Multiple requesters accessing same credential

---

## Security Checklist

- [ ] All user inputs validated (non-zero addresses, non-zero hashes)
- [ ] Checks-Effects-Interactions pattern followed
- [ ] ReentrancyGuard on token minting functions
- [ ] Access control: only owner can grant/revoke consent
- [ ] No plaintext PII stored on-chain
- [ ] Events emitted for all state changes
- [ ] Custom errors or clear revert messages
- [ ] No integer overflow (Solidity 0.8+ handles this)
- [ ] No dangerous delegatecall or selfdestruct

---

## Common Issues & Solutions

### Issue 1: "Contract not deployed" error
**Solution**: Make sure to deploy contracts in correct order (DigitalIdentity first, then ConsentManager, etc.)

### Issue 2: "MINTER_ROLE denied" error
**Solution**: Grant MINTER_ROLE to DataSharing contract after deploying RewardToken

### Issue 3: High gas costs
**Solution**: Use events instead of storage arrays, use bytes32 instead of strings

### Issue 4: Tests timing out
**Solution**: Increase timeout in test file: `this.timeout(60000);`

---

## Next Steps After Implementation

1. **Run all tests**: `npx hardhat test`
2. **Check gas costs**: Review gas-report.txt
3. **Optimize**: Reduce gas usage where possible
4. **Deploy to testnet** (optional): Goerli, Sepolia, or Mumbai
5. **Build frontend** (bonus): React + Viem.js
6. **Write final report**: Include all deliverables

---

## Resources

- **Hardhat Docs**: https://hardhat.org/docs
- **OpenZeppelin Contracts**: https://docs.openzeppelin.com/contracts
- **Solidity Docs**: https://docs.soliditylang.org
- **Ethereum Dev Resources**: https://ethereum.org/en/developers/

---

## Summary

This guide provides:
- VSCode setup for Solidity
- Hardhat project initialization
- Implementation roadmap (4 contracts)
- Testing strategy
- Deployment script template
- Gas optimization tips
- Security checklist

**You now have everything needed to implement the smart contracts designed in Step 2B.**

Good luck with your implementation!