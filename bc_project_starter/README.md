# EduChain - Blockchain Credential Verification Platform

A decentralized platform for students to share academic credentials with employers using blockchain's immutability for tamper-proof verification.

## Quick Links

- **[FLOW.md](FLOW.md)** - READ THIS FIRST! Explains how everything works, demo vs production, blockchain concepts
- **[Interactive CLI Demo](#running-the-interactive-cli)** - Best way to test the system
- **[Project Structure](#project-structure)** - Where to find things
- **[Docs](/docs)** - Detailed specifications

---

## What This Project Does

### The Core Idea

Students store cryptographic hashes of their diplomas on the blockchain. When an employer wants to verify a diploma:
1. Employer requests access (needs student's consent)
2. Student grants time-limited consent (30 days, 90 days, etc.)
3. Employer retrieves the hash from blockchain
4. Employer gets the actual diploma file from student (email, IPFS, etc.)
5. Employer verifies: `hash(diploma_file) == blockchain_hash`
6. If they match, the diploma is authentic and hasn't been tampered with

The blockchain provides **immutable verification** without storing sensitive data.

### Why Blockchain?

- **Immutability**: Once a hash is stored, no one can change it
- **Transparency**: All access is logged permanently
- **Ownership**: Students control their data through private keys
- **Trust**: No central authority can manipulate records

We're using blockchain's immutability property as a tamper-proof timestamp and verification mechanism.

---

## IMPORTANT: This is a Testing Demo

### What You're Looking At

This project contains:
- Smart contracts (production-ready)
- Deployment scripts
- Demo scripts that show how it works
- Interactive CLI for testing
- NO frontend (no React app, no UI)
- NO real user accounts (just test accounts)

### Demo vs Real Applications

**Our Demo (What we have):**
- Local Hardhat network
- You can switch between accounts instantly
- All transactions are instant and free
- Everything runs on your computer

**Real Application (What would be built):**
- Deployed to real blockchain (Ethereum, Polygon, etc.)
- Each user has their own wallet (MetaMask)
- Each user pays gas fees for transactions
- Frontend website that connects to contracts
- Users sign transactions with their private keys
- You can't act on behalf of other users

**Key Difference:**
> In our CLI, you can switch from being "Alice" to being "TechCorp" instantly. In a real app, that's impossible. Alice has her wallet, TechCorp has theirs, and they can only sign transactions for themselves.

For a detailed explanation, read **[FLOW.md](FLOW.md)** section "Demo vs Real Application".

---

## Project Structure

```
bc_project_starter/
├── README.md                    # This file - overview
├── FLOW.md                      # How everything works - READ THIS!
│
├── contracts/                   # Smart contracts (Solidity)
│   ├── DigitalIdentity.sol      # User registration + credential storage
│   ├── ConsentManager.sol       # Time-limited consent management
│   ├── DataSharing.sol          # Main contract - access control + rewards
│   ├── RewardToken.sol          # ERC20 token (EDUSHARE)
│   └── interfaces/              # Contract interfaces
│
├── scripts/                     # Testing and deployment
│   ├── deploy.js                # Deploy all contracts
│   ├── demo.js                  # Basic demo (simple)
│   ├── demo-with-files.js       # File-based demo (realistic)
│   └── interactive-cli.js       # Interactive CLI (best for testing)
│
├── test/                        # Tests (102 tests, all passing)
│   ├── DigitalIdentity.test.js  # 19 tests
│   ├── ConsentManager.test.js   # 26 tests
│   ├── RewardToken.test.js      # 19 tests
│   ├── Integration.test.js      # 15 tests
│   ├── DataSharing.audit.test.js # 15 tests
│   └── Scalability.test.js      # 8 tests
│
├── docs/                        # Design documentation
│   ├── 01-functional-requirements.md
│   ├── 02-system-design.md
│   ├── 03-smart-contract-design.md
│   └── 04-implementation-guide.md
│
└── docs/diagrams/               # System diagrams
    ├── architecture-diagram.md
    ├── consent-workflow.md
    └── access-workflow.md
```

---

## Getting Started

### Install Dependencies

```bash
npm install
```

### Compile Contracts

```bash
npx hardhat compile
```

### Run Demos

**Option 1: Interactive CLI (Recommended)**

*Standalone mode (deploys its own contracts):*
```bash
npx hardhat run scripts/interactive-cli.js
```
Deploys fresh contracts in-memory, nothing persists after exit. Quick testing.

*Connected mode (uses running node):*
First start a local node and deploy contracts:
```bash
# Terminal 1
npx hardhat node

# Terminal 2
npx hardhat run scripts/deploy.js --network localhost
npx hardhat run scripts/interactive-cli.js --network localhost
```
Connects to deployed contracts, shares blockchain with other demos. You'll see transactions appear in the node terminal.

**Option 2: File-Based Demo (Shows Blockchain Activity)**
First start a local node in one terminal:
```bash
npx hardhat node
```
Then in another terminal:
```bash
npx hardhat run scripts/demo-with-files.js --network localhost
```
This creates actual diploma files, stores their hashes, and demonstrates the verification process. You'll see blockchain activity (blocks, transactions) in the node terminal.

**Option 3: Basic Demo**
```bash
npx hardhat run scripts/demo.js
```
Simple script showing the basic workflow without files.

---

## Running the Interactive CLI

The CLI is the best way to test and understand the system:

```bash
npx hardhat run scripts/interactive-cli.js
```

### What You Can Do

1. **Select Account** - Switch between 5 test accounts
2. **Register User** - Register as student or employer
3. **Store Credential** - Create diploma file and store hash
4. **Grant Consent** - Give someone access for X days
5. **Access Credential** - Retrieve hash (if you have consent)
6. **Revoke Consent** - Remove someone's access
7. **View Token Balance** - Check EDUSHARE tokens
8. **List Accounts** - See all accounts and their status

### Example Walkthrough

```
1. Select account 1 (Alice - student)
2. Register Alice
3. Store credential (creates diploma file)
4. Grant consent to account 2 for 30 days
5. See Alice earned 10 EDUSHARE tokens

6. Select account 2 (TechCorp - employer)
7. Access Alice's credential
8. See the hash retrieved successfully

9. Select account 1 (Alice)
10. Revoke consent to account 2
11. Alice keeps her tokens

12. Select account 2 (TechCorp)
13. Try to access again - gets denied
```

---

## The Smart Contracts

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
- Logs all access attempts

### RewardToken.sol
- ERC20 token (EDUSHARE)
- Students earn 10 tokens per consent grant
- Role-based minting

**Full flow diagram in [FLOW.md](FLOW.md)**

---

## Key Features

- **Privacy-Preserving**: Only hashes on-chain, actual data stays off-chain
- **Time-Limited Access**: Consent expires after specified duration
- **Revocable**: Students can revoke consent anytime
- **Incentivized**: 10 EDUSHARE tokens per consent grant
- **Audit Trail**: All access logged immutably
- **Tamper-Proof**: Cryptographic verification prevents forgery

---

## How It Would Work in Production

For a detailed explanation of how this would work on a real blockchain with real users, read the **[FLOW.md](FLOW.md)** section "How It Would Work on a Real Blockchain".

**Quick summary:**
1. Deploy contracts to real network (Ethereum, Polygon, etc.)
2. Build frontend (React website)
3. Users connect with MetaMask or similar wallet
4. Each user signs their own transactions
5. Users pay gas fees for write operations
6. Files stored on IPFS or sent via email
7. Everything is permanent and public (except actual files)

**Cost estimate per student:**
- Registration: $3-10
- Store credential: $2-5
- Grant consent: $5-15 (but you get tokens back)
- Total: ~$10-30 for lifetime credential management

---

## Running Tests

All tests are complete and passing:

```bash
npx hardhat test
```

This runs 102 tests across 6 test files covering all contract functionality, including scalability analysis.

To see gas costs:

```bash
npx hardhat test
# Results saved to gas-report.txt
```

---

## Understanding Blockchain Concepts

### Transactions
Every write operation (register, store, grant, revoke) is a transaction that:
- Costs gas (fees paid to miners)
- Takes time to process (blocks need to be mined)
- Is permanent once confirmed
- Cannot be undone

### Accounts
- Each account has a private key (secret) and address (public)
- Private key signs transactions
- You can't make transactions for someone else
- Our CLI simulates multiple accounts on one computer

### Immutability
- Once data is on the blockchain, it can't be changed
- You can only add new data
- This is why it's perfect for verification

### On-Chain vs Off-Chain
- **On-Chain**: Hashes, consent records, logs (expensive, permanent)
- **Off-Chain**: Actual diploma files (cheap, private)

For more details, see **[FLOW.md](FLOW.md)**.

---

## Common Questions

**Q: Why not store the diploma file on blockchain?**
A: Too expensive. A 1MB file would cost thousands of dollars in gas fees. We only store the hash (32 bytes).

**Q: How do employers get the actual diploma?**
A: Students send it off-chain (email, IPFS, Google Drive, etc.). Employers verify it matches the blockchain hash.

**Q: Can students fake their diploma?**
A: No. If they modify the file, the hash won't match. The blockchain hash proves the original file hasn't been tampered with.

**Q: What stops someone from accessing my credential without consent?**
A: The smart contract checks consent before returning any data. No consent = no access. It's enforced at the code level.

**Q: Why do I need to "switch accounts" in the CLI?**
A: That's just for testing. In a real app, each person has their own wallet and can only act as themselves.

**Q: Is this actually decentralized?**
A: The smart contracts are decentralized (on blockchain). File storage is up to you (local, IPFS, centralized server).

---

## Technical Details

**Solidity**: ^0.8.20
**Framework**: Hardhat
**Token Standard**: ERC20 (OpenZeppelin)
**Security**: ReentrancyGuard, Checks-Effects-Interactions, Role-Based Access
**Network**: Local Hardhat (demo), deployable to any EVM chain

---

## Documentation

All design docs are in `/docs`:
- `01-functional-requirements.md` - What the system needs to do
- `02-system-design.md` - Data models and consent model
- `03-smart-contract-design.md` - Contract specifications
- `04-implementation-guide.md` - Hardhat setup guide

All diagrams are in `/diagrams`:
- `architecture-diagram.md` - Contract relationships
- `consent-workflow.md` - Grant/revoke flow
- `access-workflow.md` - Access verification flow

---

## For Colleagues

If you're trying to understand this project:

1. **Read [FLOW.md](FLOW.md)** - Explains everything in detail
2. **Run `interactive-cli.js`** - Play with the system
3. **Read the contract code** - It's well commented
4. **Check the demo scripts** - Shows real usage
5. **Look at the docs** - Design specifications

The key insight is that we're using blockchain as a **tamper-proof verification layer**, not as a database. The immutability property is what makes this work.

---

## License

MIT
