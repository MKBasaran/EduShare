# EduChain - Blockchain Credential Verification Platform

A decentralized platform for students to share academic credentials with employers using blockchain's immutability for tamper-proof verification.

## Overview

Students store cryptographic hashes of their diplomas on the blockchain. Employers can only verify credentials with explicit, time-limited consent from students. Every access attempt is logged immutably. Students earn tokens for sharing their data.

## Core Concept

1. Student uploads diploma and stores its hash on-chain
2. Student grants time-limited consent to specific employers
3. Employer retrieves the hash from blockchain
4. Employer verifies the actual diploma file matches the hash
5. If hashes match, the diploma is authentic
6. Student can revoke access anytime

The blockchain provides immutable verification without storing sensitive data publicly.

---

## Team

- Kaan Basaran
- Cristian Babalau
- Adrian Rusu
- Aleksandar Stoychev
- Selim Elkaffas

---

## Project Structure

```
bc_project_starter/
├── contracts/                   # Smart contracts (Solidity)
│   ├── DigitalIdentity.sol      # User registration + credential storage
│   ├── ConsentManager.sol       # Time-limited consent management
│   ├── DataSharing.sol          # Main contract - access control + rewards
│   ├── RewardToken.sol          # ERC20 token (EDUSHARE)
│   └── interfaces/              # Contract interfaces
│
├── scripts/                     # Testing and deployment
│   ├── deploy.js                # Deploy all contracts
│   ├── demo.js                  # Basic demo
│   ├── demo-with-files.js       # File-based demo
│   └── interactive-cli.js       # Interactive CLI (recommended)
│
├── test/                        # Tests (90 tests, all passing)
│   ├── DigitalIdentity.test.js  # 19 tests
│   ├── ConsentManager.test.js   # 26 tests
│   ├── RewardToken.test.js      # 19 tests
│   ├── Integration.test.js      # 13 tests
│   ├── DataSharing.audit.test.js # 5 tests (event-based auditing)
│   └── Scalability.test.js      # 8 tests
│
└── diagrams/                    # System diagrams
    ├── architecture-diagram.md
    ├── consent-workflow.md
    └── access-workflow.md
```

---

## Quick Start

### Installation

```bash
npm install
```

### Compile Contracts

```bash
npx hardhat compile
```

### Run Interactive Demo

**Option 1: Standalone Mode (Recommended)**

```bash
npx hardhat run scripts/interactive-cli.js
```

Deploys fresh contracts in-memory. Quick testing without needing a separate node.

**Option 2: Connected Mode (With Running Node)**

```bash
# Terminal 1
npx hardhat node

# Terminal 2
npx hardhat run scripts/deploy.js --network localhost
npx hardhat run scripts/interactive-cli.js --network localhost
```

Connects to deployed contracts on your running node. Transactions appear in the node terminal.

### Run Tests

```bash
npx hardhat test
```

Runs 90 tests covering all contract functionality, including scalability analysis and event-based audit logging. Results saved to `gas-report.txt`.

---

## Interactive CLI Menu

The CLI is the best way to test the system:

```bash
npx hardhat run scripts/interactive-cli.js
```

Available actions:
1. Select Account - Switch between test accounts
2. Register User - Register current account
3. Store Credential - Store a diploma hash
4. Grant Consent - Give someone access
5. Access Credential - Retrieve someone's hash (if you have consent)
6. Revoke Consent - Take away access
7. View Token Balance - Check EDUSHARE tokens
8. List Accounts - See all test accounts

### Example Workflow

```
1. Select Account 1 (Alice - student)
2. Register Alice
3. Store credential (creates diploma file)
4. Grant consent to Account 2 for 30 days
5. Alice receives 10 EDUSHARE tokens

6. Select Account 2 (TechCorp - employer)
7. Access Alice's credential
8. Hash retrieved successfully

9. Select Account 1 (Alice)
10. Revoke consent to Account 2
11. Alice keeps her tokens

12. Select Account 2 (TechCorp)
13. Try to access again - access denied
```

---

## Smart Contracts

### DigitalIdentity.sol
- User registration (students, employers)
- Credential hash storage
- All data is hashed (no plaintext on-chain)

### ConsentManager.sol
- Consent grant/revoke
- Time-based expiration (1-365 days)
- Validates all access permissions

### DataSharing.sol
- Main orchestrator contract
- Coordinates other contracts
- Rewards students with tokens
- Logs all access attempts via events

### RewardToken.sol
- ERC20 token (EDUSHARE)
- Students earn 10 tokens per consent grant
- Role-based minting (only DataSharing can mint)

---

## Key Features

- **Privacy-Preserving**: Only hashes on-chain, actual data stays off-chain
- **Time-Limited Access**: Consent expires after specified duration
- **Revocable**: Students can revoke consent anytime
- **Incentivized**: 10 EDUSHARE tokens per consent grant
- **Audit Trail**: All access logged immutably via events
- **Tamper-Proof**: Cryptographic verification prevents forgery
- **Gas-Optimized**: Event-based logging achieves 83% gas reduction

---

## Testing

### Run All Tests

```bash
npx hardhat test
```

### Test Coverage

- **DigitalIdentity.test.js** (19 tests): Registration, storage, retrieval
- **ConsentManager.test.js** (26 tests): Consent granting, revocation, expiry, validation
- **RewardToken.test.js** (19 tests): ERC20 functionality, role management, minting
- **Integration.test.js** (13 tests): Full user journeys with multiple users and credentials
- **DataSharing.audit.test.js** (5 tests): Event-based audit logging
- **Scalability.test.js** (8 tests): O(1) constant gas cost per operation, linear scaling

**Total: 90 tests, all passing**

### Gas Costs

Gas costs are automatically measured during tests and saved to `gas-report.txt`.

**Deployment Costs (one-time):**
- DigitalIdentity: ~404k gas
- ConsentManager: ~550k gas
- RewardToken: ~781k gas
- DataSharing: ~784k gas

**Transaction Costs (per operation):**
- RegisterUser: ~113k gas
- StoreCredential: ~71k gas
- SetConsent: ~102k gas
- GrantConsentAndReward: ~150k gas
- AccessData: ~43k gas (event-based logging only)
- RevokeConsent: ~34k gas

---

## Architecture

### Contract Interactions

```
DataSharing (Main Orchestrator)
    ├── DigitalIdentity (User registration, credential storage)
    ├── ConsentManager (Consent validation)
    └── RewardToken (Token minting)
```

See `diagrams/architecture-diagram.md` for detailed visual overview.

### Data Storage

**On-Chain (Blockchain):**
- User registration hashes (idHash, emailHash, studentIdHash)
- Credential hashes
- Consent records (who, what, when, until when)
- Access event logs (via transaction logs)
- Token balances

**Off-Chain (Not on Blockchain):**
- Actual diploma files
- Personal information in plaintext
- Private keys

---

## Security

### Implemented Protections

- **Checks-Effects-Interactions Pattern**: All validations before state changes
- **ReentrancyGuard**: Protects against reentrancy attacks
- **Role-Based Access Control**: Only authorized addresses can mint tokens
- **Custom Errors**: Gas-efficient error handling
- **Input Validation**: All user inputs validated
- **No Plaintext PII**: Only hashes stored on-chain

### Audit Trail

All access attempts are logged via events:
- **AccessGranted**: Owner, requester, credential type, hash, timestamp
- **AccessDenied**: Owner, requester, credential type, reason, timestamp

Events are permanent, immutable, and queryable off-chain via RPC.

---

## Gas Optimization

| Optimization | Applied To | Savings |
|--------------|------------|---------|
| Use `bytes32` for hashes | All contracts | ~30% vs strings |
| Use `mapping` over `array` | All contracts | O(1) vs O(n) |
| Use `immutable` for contract refs | DataSharing | ~2100 gas/read |
| Custom errors vs strings | All contracts | ~20 gas/revert |
| Delete vs marking revoked | ConsentManager | Gas refund |
| Events vs storage arrays | DataSharing | 83% reduction (~217k gas) |

**Key Optimization**: Event-based logging reduces AccessData cost from ~260k to ~43k gas.

---

## Scalability

### Constant Time Operations (O(1))

All core operations maintain constant gas cost regardless of:
- Total number of users in the system
- Number of credentials per user
- Number of access attempts

Proven by Scalability.test.js with empirical measurements.

---

## Production Deployment

### Requirements

1. Deploy contracts to target network (Ethereum, Polygon, etc.)
2. Frontend application for user interaction
3. User wallet integration (MetaMask, WalletConnect, etc.)
4. Off-chain file storage solution (IPFS, cloud storage, email)

### Deployment Steps

```bash
# Example: Deploy to Sepolia testnet
npx hardhat run scripts/deploy.js --network sepolia
```

After deployment, contracts receive permanent addresses. Update frontend configuration with these addresses.

### Estimated Costs (Mainnet)

**Per Student:**
- Registration: $3-10 (one-time)
- Store credential: $2-5 (one-time)
- Grant consent: $5-15 (receives tokens)
- **Total: ~$10-30 for lifetime credential management**

**Per Employer:**
- Registration: $3-10 (one-time)
- Access credential: $2-5 (per verification)

---

## Technical Specifications

- **Solidity Version**: 0.8.20
- **Framework**: Hardhat
- **Dependencies**: OpenZeppelin Contracts
- **Token Standard**: ERC20
- **Testing**: Chai, Ethers.js
- **Networks**: Local Hardhat, deployable to any EVM-compatible chain

---

## Additional Resources

### Diagrams

Visual flowcharts available in `/diagrams`:
- `architecture-diagram.md` - Contract relationships and data flow
- `consent-workflow.md` - Consent grant/revoke process
- `access-workflow.md` - Credential access verification flow

### Demo Scripts

- `scripts/demo.js` - Basic demonstration of core functionality
- `scripts/demo-with-files.js` - Creates actual diploma files and demonstrates hash verification
- `scripts/interactive-cli.js` - Interactive menu for testing all features

---

## Common Questions

**Q: Why not store the diploma file on blockchain?**
A: Storage costs would be prohibitive. A 1MB file would cost thousands of dollars in gas fees. Storing only the hash (32 bytes) costs a few dollars.

**Q: How do employers get the actual diploma?**
A: Students send files off-chain (email, IPFS, cloud storage). Employers verify the file matches the blockchain hash.

**Q: Can students fake their diploma?**
A: If the file is modified, the hash will not match. The blockchain hash proves authenticity.

**Q: What prevents unauthorized access?**
A: Smart contract code enforces consent checks. No consent = no access. Enforcement is cryptographic, not trust-based.

**Q: Is this system decentralized?**
A: Smart contracts are decentralized (on blockchain). File storage method is implementation-dependent (can be IPFS for full decentralization).

---

## Development

### Run Local Node

```bash
npx hardhat node
```

### Deploy Locally

```bash
npx hardhat run scripts/deploy.js --network localhost
```

### Run Specific Test File

```bash
npx hardhat test test/DigitalIdentity.test.js
```

### View Gas Report

```bash
npx hardhat test
cat gas-report.txt
```

---

## License

MIT

---

## Contributing

This is an academic project demonstrating blockchain credential verification. The smart contracts are production-ready, but a complete production system would require:

- Frontend application
- User wallet integration
- Off-chain file storage infrastructure
- Production-grade key management
- User experience optimization

Feel free to use this as a foundation for building such a system.
