# Report Reference - What Code to Use Where

Quick reference for writing our project report. This lists what files and code we'll need for each section.

## Introduction Section

**Problem & Motivation:**
- Check the README.md intro - explains why educational credential verification is slow and prone to fraud
- FLOW.md has good context about current manual verification processes
- Use this to set up why blockchain matters here

**Solution Overview:**
- README.md "System Overview" section explains the 4-contract architecture at a high level
- FLOW.md "System Components" breaks down what each contract does
- Basically: off-chain files + on-chain hashes + consent management + token rewards

## Architecture Section

**System Design:**
- All three diagrams are in docs/diagrams/
  - architecture-diagram.md - shows all 4 contracts and how they connect
  - consent-workflow.md - explains how students grant/revoke access
  - access-workflow.md - shows what happens when someone tries to view a credential
- contracts/ folder structure shows the separation of concerns (identity vs consent vs sharing vs rewards)

**Component Descriptions:**
- DigitalIdentity.sol (lines 1-50) - the struct definitions and state variables show how user data is stored
- ConsentManager.sol (lines 1-60) - same thing, shows the Consent struct and validation constants
- DataSharing.sol (lines 1-80) - brings everything together, includes the AccessLog struct for audit trail
- RewardToken.sol - simple ERC20, just extends OpenZeppelin contracts

**Key Design Decisions:**
- Privacy: Look at how RegisterUser (DigitalIdentity.sol:65-81) and StoreCredential (DigitalIdentity.sol:89-102) only store hashes, never actual data
- Security: ConsentManager.sol has tons of validation checks (lines 68-112 in SetConsent function)
- Audit: DataSharing.sol AccessData function (lines 142-190) logs every single access attempt on-chain

## Implementation Section

**Contract Code:**

*DigitalIdentity.sol* - 149 lines total
- RegisterUser function (lines 65-81): How users register with hashed info
- StoreCredential function (lines 89-102): Storing credential hashes
- Key point: Uses keccak256 hashing, only stores bytes32 hashes on chain
- The actual diploma files stay off-chain (see student_data/ folder)

*ConsentManager.sol* - 191 lines total
- SetConsent function (lines 68-112): All the validation logic
  - Checks both users registered
  - Validates credential exists
  - Enforces 1-365 day duration limit
  - Prevents self-consent
- RevokeConsent function (lines 121-137): Simple revocation mechanism
- CheckConsent function (lines 146-169): Checks if consent is valid and not expired

*DataSharing.sol* - 288 lines total
- GrantConsentAndReward function (lines 91-130): Main entry point for granting consent
  - Calls ConsentManager
  - Mints 10 EDUSHARE tokens as reward
  - Uses ReentrancyGuard for security
- AccessData function (lines 142-190): The core data access flow
  - Validates consent
  - Retrieves credential hash
  - Logs everything on-chain (AccessLog array)
  - Returns the hash if authorized
- GetAccessLog functions (lines 201-236): Query the audit trail

*RewardToken.sol* - 38 lines total
- Basic ERC20 token called "EduShareToken" (EDUSHARE)
- mint function (lines 23-26): Only accounts with MINTER_ROLE can mint
- In our system, only the DataSharing contract has MINTER_ROLE
- Standard OpenZeppelin implementation, nothing custom except the TokensRewarded event

**Gas Optimization:**
- Look at gas-report.txt to see actual costs
- We used view/pure functions where possible (check all the getter functions)
- Checks-Effects-Interactions pattern in GrantConsentAndReward (lines 91-130 in DataSharing.sol)
- Minimal storage writes - only store what's absolutely necessary

**Security Patterns:**
- ReentrancyGuard on GrantConsentAndReward and AccessData (see imports in DataSharing.sol:5)
- AccessControl for role-based permissions (RewardToken.sol uses this)
- Input validation everywhere (search for "revert" statements across contracts)
- Custom errors instead of require strings (saves gas, see error definitions at top of each contract)

## Experimental Results Section

**Test Coverage:**
- test/ folder has 6 test files, 90 total tests, all passing
- DigitalIdentity.test.js: 19 tests covering registration, storage, retrieval
- ConsentManager.test.js: 26 tests covering consent granting, revocation, expiry, validation
- RewardToken.test.js: 19 tests covering ERC20 functionality, role management, minting
- Integration.test.js: 13 tests showing full user journeys with multiple users and credentials
- DataSharing.audit.test.js: 5 tests for event-based audit logging (AccessGranted/AccessDenied events)
- Scalability.test.js: 8 tests proving O(1) constant gas cost per operation, linear scaling, and calculating theoretical throughput

Run `npx hardhat test` to see the output - should show all 90 passing with execution times.

**Gas Measurements:**
The gas-report.txt file (generated when running tests) contains:

Deployment costs (one-time):
- DigitalIdentity: ~392k gas
- ConsentManager: ~549k gas
- RewardToken: ~780k gas
- DataSharing: ~1.5M gas
- Total: ~3.2M gas to deploy entire system

Function costs (per transaction):
- RegisterUser: ~113k gas (creates new user)
- StoreCredential: ~71k gas (adds credential hash)
- SetConsent: ~102k gas average (grants permission)
- GrantConsentAndReward: ~150k gas (wrapper that calls SetConsent + mints tokens)
- AccessData: ~43k gas (event-based logging only)
- RevokeConsent: ~34k gas (cheapest - just updates one boolean)

**Why AccessData is Gas-Efficient (43k gas):**

AccessData uses event-based audit logging instead of storage, making it highly efficient:

1. **External Contract Calls** (~25k gas):
   - Calls ConsentManager.CheckConsent() - reads consent record from another contract
   - Calls DigitalIdentity.GetCredentialHash() - reads credential from another contract
   - Cross-contract view calls are relatively cheap

2. **Event Emission** (~8k gas):
   - Emits AccessGranted or AccessDenied event with indexed parameters
   - Events are stored in transaction logs (not contract storage)
   - Much cheaper than storage writes (~375 gas per log entry + ~375 gas per topic)

3. **ReentrancyGuard Overhead** (~10k gas):
   - Sets and clears reentrancy lock

**Design Decision:**
We chose event-based logging over storage arrays for an 83% gas reduction (from ~260k to ~43k). Events provide:
- Permanent audit trail in transaction logs (on-chain)
- Indexed parameters for efficient filtering
- Off-chain queryable via RPC calls
- No storage slot costs

The trade-off is that events cannot be queried from within smart contracts (only off-chain), but this is acceptable for an audit logging use case.

**Scalability Test Results:**

The Scalability.test.js file contains 8 tests that provide empirical evidence of system scalability. These tests can be run with:
```bash
npx hardhat test test/Scalability.test.js
```

Key findings from the scalability tests:

1. **Constant Gas Cost (O(1) Complexity)**:
   - 10 user registrations: Average 135,720 gas, max deviation <1%
   - Proves per-operation cost doesn't increase with network size
   - User #2 and User #20 both cost ~93k gas to store a credential

2. **Linear Scaling (Not Exponential)**:
   - Total cost = number of users × constant per-user cost
   - 100 users = 13.5M gas total, $13.57 per user
   - 1,000,000 users = 135.7B gas total, still $13.57 per user
   - Cost per user remains constant regardless of scale

3. **AccessData Constant Cost**:
   - All accesses: ~43k gas (< 5% variation)
   - Proves O(1) complexity with event-based logging
   - No gas cost increase as access logs grow
   - Constant time operation regardless of system scale

4. **Theoretical Throughput**:
   - Ethereum (30M gas/block, 12 sec blocks): 221 users/block = 1,105 users/minute
   - Polygon (30M gas/block, 2 sec blocks): 221 users/block = 6,630 users/minute
   - Demonstrates system can scale to handle large university deployments

5. **Network Size Independence**:
   - Comparing early users vs late users shows identical gas costs
   - Total registered users in system doesn't affect individual transaction cost
   - Demonstrates true O(1) constant time complexity

This data demonstrates:
- System scales linearly (optimal for blockchain applications)
- Cost per user is predictable and constant
- Can handle university-scale deployments (10k-100k users)
- Layer 2 solutions (Polygon) provide 5x throughput improvement

**Live Blockchain Output:**
The terminal output from running demos (blocks 1-10) shows actual transactions:
- Block 1-4: Contract deployments
- Blocks 5-10: User registration, credential storage, consent granting, data access
- Each block shows: block number, contract address, transaction hash, gas used
- deployment-addresses.json shows where contracts were deployed on localhost

**Demo Scripts:**

*interactive-cli.js*
- Interactive menu for testing the system
- Two modes:
  - Standalone: `npx hardhat run scripts/interactive-cli.js` (deploys fresh contracts in-memory)
  - Connected: `npx hardhat run scripts/interactive-cli.js --network localhost` (uses deployed contracts)
- Connected mode requires deployment-addresses.json and running node
- Best for quick testing and understanding the flow

*demo-with-files.js*
- Creates 3 diploma files in student_data/:
  - alice_bachelor_diploma.json (original)
  - alice_bachelor_diploma_received.json (copy with same hash)
  - alice_bachelor_diploma_tampered.json (modified data, different hash)
- Uses deployed contracts from running hardhat node
- Shows hash verification catches tampering
- Proves off-chain + on-chain model works
- Run: First start `npx hardhat node`, then in another terminal `npx hardhat run scripts/demo-with-files.js --network localhost`

## Discussion/Conclusion Section

**What Works Well:**
- Privacy: Only hashes on blockchain, raw data stays off-chain
- Security: Multiple layers of validation, on-chain audit trail
- Incentives: Token rewards encourage participation
- Transparency: All access attempts logged permanently
- Control: Students can grant and revoke at will
- Trust: No central authority needed

**Current Limitations:**
- Gas costs: AccessData is ~43k gas per access (~$2-5 depending on network)
  - See gas-report.txt line 18 for exact measurements
  - Cost optimized through event-based audit logging (83% reduction from original 260k)
  - Employer pays this fee each time they verify a credential
- Scalability: While gas-efficient, Ethereum mainnet still has per-transaction costs
  - Each of the 35 AccessData calls in tests cost consistent ~43k gas
  - Popular students (100+ job applications) generate predictable verification costs (paid by employers)
- Storage: Off-chain files still need secure storage solution
  - Right now they're just in student_data/ folder
  - Production needs IPFS, encrypted cloud storage, or email
- UX: Users need to understand wallets, gas, private keys
  - demo-with-files.js shows this is complex even for developers
  - Both students AND employers need crypto wallets

**Future Improvements:**
- Layer 2 deployment (Polygon, Optimism, Arbitrum) would cut gas costs by 90%+
- IPFS integration for decentralized off-chain storage
- Better key management (social recovery, multi-sig)
- Batch operations to amortize deployment costs
- Integration with university systems (APIs, single sign-on)

**Real-World Adoption Challenges:**
- Students need to get their diplomas verified/signed by universities first (chicken-and-egg problem)
- Employers aren't looking for credentials on blockchain yet (no demand)
- Legal questions about GDPR and right-to-be-forgotten (hashes are on blockchain forever)
- Both students AND employers need crypto wallets and ETH for gas
- High gas costs discourage adoption (employers won't pay $10-50 per verification)
- One-time deployment cost: 3.2M gas (~$200-1000 depending on gas prices)

**Be Honest About These:**
- This is a proof-of-concept, not production-ready
- The demo uses a single machine (localhost testnet)
- Real deployment needs proper key management
- Gas costs might be prohibitive without Layer 2
- Adoption requires buy-in from universities AND employers

## Quick File Reference

**Smart Contracts:**
- contracts/DigitalIdentity.sol
- contracts/ConsentManager.sol
- contracts/DataSharing.sol
- contracts/RewardToken.sol
- contracts/interfaces/*.sol (4 interface files)

**Tests:**
- test/DigitalIdentity.test.js
- test/ConsentManager.test.js
- test/RewardToken.test.js
- test/Integration.test.js
- test/DataSharing.audit.test.js
- test/Scalability.test.js

**Documentation:**
- README.md (setup, overview, FAQ)
- FLOW.md (complete system explanation)
- docs/diagrams/ (3 architecture diagrams)
- gas-report.txt (actual measurements)

**Demo/Data:**
- scripts/demo-with-files.js (shows off-chain verification)
- student_data/alice_bachelor_diploma.json (sample credential)
- deployment-addresses.json (contract addresses from last deployment)

**Configuration:**
- hardhat.config.js (development environment setup)
- package.json (dependencies)

