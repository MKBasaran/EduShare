# EduChain System Flow & Architecture

## Table of Contents
1. [Understanding the System](#understanding-the-system)
2. [Demo vs Real Application](#demo-vs-real-application)
3. [How It Would Work on a Real Blockchain](#how-it-would-work-on-a-real-blockchain)
4. [Complete System Flow](#complete-system-flow)
5. [What Happens On-Chain vs Off-Chain](#what-happens-on-chain-vs-off-chain)
6. [Transaction Flow](#transaction-flow)
7. [Testing with the Interactive CLI](#testing-with-the-interactive-cli)

---

## Understanding the System

### What Problem Are We Solving?

Students have no control over their academic credentials. When you apply for a job, you send your diploma to HR, and you have:
- No control over who sees it after that
- No way to revoke access
- No audit trail of who accessed it
- No way to verify if it's been tampered with

### Our Solution

We use blockchain's **immutability** property as a verification mechanism. Here's the key insight:

> **The blockchain doesn't store diplomas. It stores cryptographic hashes that prove diplomas haven't been tampered with.**

Think of it like this:
- You take a photo and post its fingerprint (hash) on a public billboard (blockchain)
- Later, someone shows you a photo claiming it's yours
- You compute the fingerprint of their photo and compare it to the billboard
- If they match, the photo is authentic. If not, it's been modified.

---

## Demo vs Real Application

### IMPORTANT: Our CLI is for Testing Only

**What the CLI lets you do (FOR TESTING):**
- Switch between different accounts instantly
- Act as different users (student, employer)
- Deploy contracts locally
- See everything happen in real-time

**What you CANNOT do in a real application:**
- You can't just "switch accounts" - each user has their own wallet
- You can't see other people's private keys or sign transactions for them
- Each person controls their own account through their wallet (like MetaMask)

### How It Would Actually Work

In a real application:

1. **Each user has their own wallet** (MetaMask, WalletConnect, etc.)
2. **Each user signs their own transactions** with their private key
3. **You can't act on behalf of someone else** unless they sign the transaction
4. **There would be a frontend** (React app, web interface) that connects to wallets
5. **The frontend would call the smart contracts** through the user's wallet

**Example Real-World Flow:**

```
Student Alice                          Employer Bob
    |                                       |
    | Opens MetaMask                        | Opens MetaMask
    | Connects to EduChain app              | Connects to EduChain app
    |                                       |
    | Clicks "Register" button              |
    | MetaMask pops up                      |
    | Signs transaction with private key    |
    | Transaction sent to blockchain        |
    |                                       |
    | Clicks "Grant Consent to Bob"         |
    | MetaMask pops up again                |
    | Signs transaction                     |
    | Transaction sent to blockchain        |
    |                                       |
    |                              Now Bob can access
    |                              Clicks "Access Credential"
    |                              MetaMask pops up
    |                              Signs transaction
    |                              Retrieves hash from blockchain
```

**Key Differences:**
- **CLI Demo**: One computer, switching accounts instantly for testing
- **Real App**: Multiple users, each with their own wallet, each signing their own transactions

---

## How It Would Work on a Real Blockchain

### Deployment Phase (One-Time Setup)

1. **Deploy to a real network** (Sepolia testnet, Ethereum mainnet, Polygon, etc.)
2. **Contracts get permanent addresses** on that blockchain
3. **Anyone can interact** with those contracts if they know the addresses
4. **Deployer pays gas fees** for deployment

Example:
```bash
# Instead of Hardhat's local network, deploy to Sepolia testnet
npx hardhat run scripts/deploy.js --network sepolia
```

After deployment, you get permanent contract addresses like:
```
DigitalIdentity:  0x5FbDB2315678afecb367f032d93F642f64180aa3
ConsentManager:   0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
RewardToken:      0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
DataSharing:      0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
```

### User Interaction Phase

**Every action is a transaction:**

1. **Student Registers**
   - Student opens the frontend (web app)
   - Clicks "Register"
   - Frontend calls `DigitalIdentity.RegisterUser()`
   - MetaMask pops up asking student to sign
   - Student pays gas fee (maybe $2-5 depending on network)
   - Transaction gets mined (added to blockchain)
   - Student is now registered forever

2. **Student Stores Credential**
   - Student uploads diploma to frontend (stays local/IPFS)
   - Frontend computes hash of the file
   - Clicks "Store Credential"
   - MetaMask pops up
   - Student pays gas fee
   - Hash gets stored on blockchain permanently
   - Original file stays with student (or on IPFS)

3. **Student Grants Consent**
   - Student clicks "Grant consent to [employer address]"
   - Frontend calls `DataSharing.GrantConsentAndReward()`
   - MetaMask pops up
   - Student pays gas fee
   - Consent record is stored on blockchain
   - Student receives 10 EDUSHARE tokens
   - All permanent and immutable

4. **Employer Accesses Credential**
   - Employer logs in with their wallet
   - Clicks "Access Alice's diploma"
   - Frontend calls `DataSharing.AccessData()`
   - MetaMask pops up
   - Employer pays gas fee
   - Employer receives the hash from blockchain
   - Employer requests actual file from student (email, IPFS, etc.)
   - Employer verifies: hash(file) == blockchain_hash


---

## Complete System Flow

### Phase 1: Setup (Off-Chain)

```
Student's Computer
├── Creates diploma file locally
│   └── student_data/alice_diploma.json
├── Computes hash
│   └── hash = keccak256(file_content)
└── Keeps file private
```

### Phase 2: Registration (On-Chain)

```
Student                          Blockchain
  |                                  |
  |----RegisterUser()--------------->|
  |    (idHash, emailHash,           | Store student info
  |     studentIdHash)                | ✓ Permanent record created
  |<---Transaction confirmed----------|
  |                                  |

Employer                         Blockchain
  |                                  |
  |----RegisterUser()--------------->|
  |    (idHash, emailHash,           | Store employer info
  |     orgIdHash)                    | ✓ Permanent record created
  |<---Transaction confirmed----------|
```

### Phase 3: Credential Storage (On-Chain)

```
Student                          Blockchain
  |                                  |
  |----StoreCredential()------------>|
  |    (credentialType,              | Store hash only
  |     diplomaHash)                 | ✓ Hash: 0xabc123...
  |<---Transaction confirmed----------|
  |                                  |
  | Original diploma file stays      |
  | with student (OFF-CHAIN)         |
```

### Phase 4: Consent Grant (On-Chain)

```
Student                          DataSharing                ConsentManager           RewardToken
  |                                  |                            |                       |
  |--GrantConsentAndReward()-------->|                            |                       |
  |  (employer, credType, expiry)    |                            |                       |
  |                                  |---SetConsent()------------>|                       |
  |                                  |                            | Validate everything  |
  |                                  |                            | ✓ Store consent      |
  |                                  |<---------------------------|                       |
  |                                  |                            |                       |
  |                                  |---mint()-------------------------------->         |
  |                                  |  (student, 10 tokens)                   | ✓ Mint  |
  |                                  |<-----------------------------------------|         |
  |<---Transaction confirmed---------|                            |                       |
  |    + 10 EDUSHARE tokens          |                            |                       |
```

### Phase 5: Data Access (Hybrid - On-Chain + Off-Chain)

```
Employer                         DataSharing                DigitalIdentity
  |                                  |                            |
  |--AccessData()-------------------->|                            |
  |  (student, credType)             |---CheckConsent()---------->| ConsentManager
  |                                  |  ✓ Valid consent            |
  |                                  |                            |
  |                                  |---GetCredentialHash()----->|
  |                                  |                            | ✓ Returns hash
  |                                  |<---------------------------|
  |<---Returns hash: 0xabc123--------|                            |
  |                                  |                            |

Employer                         Student
  |                                  |
  |--Request diploma file----------->|
  |  (via email, HTTPS, IPFS)        | Send file off-chain
  |<---Sends alice_diploma.json------|
  |                                  |
  | Verify:                          |
  | hash(received_file) == 0xabc123  |
  | ✓ File is authentic!             |
```

### Phase 6: Revocation (On-Chain)

```
Student                          DataSharing                ConsentManager
  |                                  |                            |
  |--RevokeConsent()---------------->|                            |
  |  (employer, credType)            |---RevokeConsent()--------->|
  |                                  |                            | Delete consent
  |                                  |<---------------------------|
  |<---Transaction confirmed---------|                            |
  |    (keeps tokens)                |                            |
```

---

## What Happens On-Chain vs Off-Chain

### On-Chain (Stored on Blockchain)

**DigitalIdentity Contract:**
- User registration hashes (idHash, emailHash, studentIdHash)
- Credential type hashes (e.g., keccak256("Bachelor_Diploma"))
- Credential content hashes (e.g., hash of diploma file)

**ConsentManager Contract:**
- Consent records (who granted, to whom, for what, until when)
- Expiry timestamps
- Granted timestamps

**DataSharing Contract:**
- Access event logs (who accessed what, when - stored in transaction logs)
- Access denial event logs
- Token reward events

**RewardToken Contract:**
- Token balances
- Token transfers
- Minting events

**Total cost per student:**
- Registration: ~$3-10
- Store credential: ~$2-5
- Grant consent: ~$5-15 (but you get tokens worth money)
- **Total: ~$10-30 for lifetime credential management**

### Off-Chain (NOT on Blockchain)

**Student's Computer / Private Storage:**
- Actual diploma PDF/JSON files
- Personal information in plaintext
- Private keys (never share these!)

**IPFS / Decentralized Storage (Optional):**
- Encrypted diploma files
- Can be accessed with hash

**Centralized Server (If you build one):**
- User interface (React frontend)
- File upload/download service
- Email notifications

**Key Principle:**
> Sensitive data stays OFF-CHAIN. Only cryptographic hashes and consent records go ON-CHAIN.

---

## Transaction Flow

### What is a Transaction?

A transaction is a signed message that says "I want to execute this function with these parameters."

**Every transaction has:**
1. **From**: Your wallet address
2. **To**: The contract address
3. **Data**: The function you're calling and its parameters
4. **Gas**: How much you're willing to pay
5. **Signature**: Proof that you authorized this (your private key)

### Example: Student Grants Consent

```javascript
// Frontend code (React app)
const tx = await dataSharingContract.GrantConsentAndReward(
  employerAddress,           // Who gets access
  credentialTypeHash,        // What they can access
  expiryTimestamp           // Until when
);

// MetaMask pops up showing:
// "Sign Transaction"
// To: 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9 (DataSharing)
// Gas: 150,000 (Cost: $8.50)
// [Reject] [Confirm]

// User clicks Confirm
// Transaction gets sent to blockchain
// Wait for mining...

const receipt = await tx.wait();
// Transaction is now permanent!
```

### What Happens Behind the Scenes

1. **User clicks "Grant Consent"**
2. **Frontend constructs transaction**
3. **MetaMask asks user to sign**
4. **User's private key signs the transaction** (never leaves MetaMask)
5. **Signed transaction sent to blockchain network**
6. **Miners/validators pick it up**
7. **They execute the smart contract code**
   - Check if student is registered
   - Check if employer is registered
   - Check if credential exists
   - Check if duration is valid
   - Store consent record
   - Mint 10 tokens to student
8. **Transaction included in a block**
9. **Block added to blockchain**
10. **Transaction is now permanent and cannot be reversed**

### Transaction Finality

- **On Ethereum**: ~15 seconds per block
- **On Polygon**: ~2 seconds per block
- **On Hardhat (local)**: Instant (for testing)

Once a transaction is in a block, it's **permanent**. You can't:
- Undo it
- Edit it
- Delete it

You can only make new transactions (like RevokeConsent).

---

## Testing with the Interactive CLI

### What the CLI Does

The CLI simulates multiple users on one computer for testing. It's like playing chess against yourself - you can see both sides.

**Two modes:**

*Standalone mode (default):*
```bash
npx hardhat run scripts/interactive-cli.js
```
Deploys fresh contracts in-memory. Nothing persists after exit. Quick testing without needing a separate node.

*Connected mode (with running node):*
```bash
# Terminal 1
npx hardhat node

# Terminal 2
npx hardhat run scripts/deploy.js --network localhost
npx hardhat run scripts/interactive-cli.js --network localhost
```
Connects to deployed contracts on your running node. Transactions appear in the node terminal. Shares blockchain with other demos.

### CLI Menu Options

```
1. Select Account        # Switch between test accounts
2. Register User         # Register current account
3. Store Credential      # Store a diploma hash
4. Grant Consent         # Give someone access
5. Access Credential     # Retrieve someone's hash (if you have consent)
6. Revoke Consent        # Take away access
7. View Token Balance    # Check EDUSHARE tokens
8. List Accounts         # See all test accounts
9. Exit
```

### Using the CLI to Understand Flow

**Scenario: Alice shares diploma with TechCorp**

```
1. Select Account → Choose Account 1 (Alice)
2. Register User
   Name: Alice
   Email: alice@university.edu
   ID: S2024001

3. Store Credential
   Name: Alice Johnson
   Major: Computer Science
   GPA: 3.85
   → Creates diploma file
   → Stores hash on blockchain

4. Grant Consent
   → Select Account 2 (TechCorp)
   → Duration: 30 days
   → Alice gets 10 EDUSHARE tokens

5. Select Account → Choose Account 2 (TechCorp)
6. Access Credential
   → Select Alice's account
   → Retrieves hash from blockchain
   → Shows: "Credential Hash: 0xabc123..."

7. Select Account → Choose Account 1 (Alice)
8. Revoke Consent
   → Select TechCorp
   → Consent deleted

9. Select Account → Choose Account 2 (TechCorp)
10. Access Credential
    → Attempt to access Alice's credential
    → ERROR: "Consent invalid or expired"
```

### Understanding Demo vs Production

**In the CLI:**
- You can be Alice, then instantly be TechCorp
- All accounts are pre-funded with fake ETH
- Transactions are instant
- Everything is on your local computer

**In Production:**
- Alice has her wallet, TechCorp has theirs
- Each pays their own gas fees with real money
- Alice can't make transactions for TechCorp
- Everything is on a public blockchain visible to everyone

---

## Key Takeaways

### What Makes This a Blockchain Application?

1. **Immutability**: Once a hash is stored, no one can change it (not even the contract owner)
2. **Transparency**: All consent grants/revokes are logged publicly
3. **Decentralization**: No single entity controls the data
4. **Verification**: Anyone can verify a credential by comparing hashes
5. **Ownership**: Students control their own data through their private keys

### What the Blockchain Provides

- **Tamper-proof storage** of hashes
- **Permanent audit trail** of who accessed what
- **Time-stamped records** that can't be backdated
- **Cryptographic proof** without revealing actual data

### What the Blockchain Does NOT Provide

- It doesn't store the actual diploma files (too expensive)
- It doesn't make transactions free (costs gas)
- It doesn't make things faster (blockchain is slower than databases)
- It doesn't provide privacy by default (everything is public)

### Why Use Blockchain for This?

Because **trust** is more important than **speed**:
- Employers trust that diplomas haven't been tampered with
- Students trust that only authorized people can verify
- Everyone trusts that the audit trail is accurate
- No central authority can manipulate records

---

## Additional Resources

- **Try the demos**: Run `demo-with-files.js` to see file creation and verification
- **Use the CLI**: Best way to understand the flow interactively
- **Read the contracts**: Comments explain what each function does
- **Check the docs/**: Detailed specifications of requirements and design
