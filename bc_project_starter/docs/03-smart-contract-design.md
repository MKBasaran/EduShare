# Step 2B: Smart Contract Design

## Overview

This platform requires **3 smart contracts** following the principle of **low coupling, high cohesion**:

1. **DigitalIdentity.sol**: Handles user registration and credential storage
2. **ConsentManager.sol**: Manages consent grants and revocations
3. **DataSharing.sol**: Verifies permissions, logs access, mints reward tokens

**Design Principles**:
- Each contract has a single, clear responsibility
- Contracts interact via interfaces (not direct storage access)
- Minimal state dependencies
- Security-first (Checks-Effects-Interactions pattern)
- Gas-optimized (mappings over arrays, bytes32 for hashes)

---

## Contract 1: DigitalIdentity.sol

### Purpose
Stores user identity attributes (hashed) and credential hashes. Does NOT handle access control or consent.

### Responsibilities
- Register users with hashed identity attributes
- Store credential hashes (not actual files)
- Provide read-only views of identity data
- Emit events for identity and credential changes

---

### State Variables

```
Struct: User {
    bytes32 idHash;           // Keccak256(user ID)
    bytes32 emailHash;        // Keccak256(email)
    bytes32 studentIdHash;    // Keccak256(student ID)
    uint256 registeredAt;     // Timestamp
    bool exists;              // Registration check
}

Struct: Credential {
    bytes32 credentialHash;   // Keccak256(credential file content)
    uint256 issuedAt;         // Timestamp
    bool exists;              // Existence check
}

Mapping: users
    mapping(address => User)

Mapping: credentials
    mapping(address owner => mapping(bytes32 credentialTypeHash => Credential))
```

---

### Functions

#### 1. RegisterUser(bytes32 idHash, bytes32 emailHash, bytes32 studentIdHash)

**Access**: Public, anyone can call

**Purpose**: Register a new user (student or requester)

**Validation**:
- Require: User not already registered (`!users[msg.sender].exists`)
- Require: All parameters are non-zero
- Require: No duplicate idHash (optional: check uniqueness)

**Effects**:
- Store user data in `users[msg.sender]`
- Set `users[msg.sender].exists = true`
- Set `users[msg.sender].registeredAt = block.timestamp`

**Interactions**:
- Emit `IdentityRegistered(address indexed user, bytes32 idHash)`

**Returns**: void

---

#### 2. StoreCredential(bytes32 credentialTypeHash, bytes32 credentialHash)

**Access**: Public, only registered users

**Purpose**: Store a credential hash (diploma, transcript, etc.)

**Validation**:
- Require: Caller is registered (`users[msg.sender].exists`)
- Require: credentialTypeHash and credentialHash are non-zero

**Effects**:
- Store credential: `credentials[msg.sender][credentialTypeHash] = Credential({credentialHash, block.timestamp, true})`
- Allow overwriting (students can update credentials)

**Interactions**:
- Emit `CredentialStored(address indexed owner, bytes32 indexed credentialTypeHash, bytes32 credentialHash)`

**Returns**: void

---

#### 3. GetCredentialHash(address owner, bytes32 credentialTypeHash) returns (bytes32)

**Access**: Public view (read-only)

**Purpose**: Retrieve a credential hash for verification

**Validation**:
- Require: Credential exists (`credentials[owner][credentialTypeHash].exists`)

**Returns**: `credentialHash` (bytes32)

**Notes**:
- This function does NOT check consent (that's ConsentManager's job)
- Used by DataSharing contract to fetch credential hashes

---

#### 4. IsRegistered(address user) returns (bool)

**Access**: Public view

**Purpose**: Check if a user is registered

**Returns**: `users[user].exists`

---

#### 5. GetUserIdHash(address user) returns (bytes32)

**Access**: Public view

**Purpose**: Get user's ID hash

**Returns**: `users[user].idHash`

**Notes**: Used for verification without revealing plaintext identity

---

### Events

```
event IdentityRegistered(
    address indexed user,
    bytes32 idHash,
    uint256 timestamp
);

event CredentialStored(
    address indexed owner,
    bytes32 indexed credentialTypeHash,
    bytes32 credentialHash,
    uint256 timestamp
);
```

---

### Security Considerations

| Risk | Mitigation |
|------|------------|
| Duplicate registration | Check `users[msg.sender].exists` |
| Invalid hashes (0x0) | Require non-zero values |
| Unauthorized credential access | Public views are OK (hashes don't reveal data) |
| Gas cost of uniqueness checks | Skip idHash uniqueness (trade-off) |

---

## Contract 2: ConsentManager.sol

### Purpose
Manages consent grants, revocations, and validity checks. Does NOT store credentials or handle token rewards.

### Responsibilities
- Create consent records (time-limited permissions)
- Revoke consent
- Check consent validity (exists, not expired, not revoked)
- Emit consent events

---

### State Variables

```
Struct: Consent {
    bool exists;              // Does this consent exist?
    uint256 expiry;           // Unix timestamp when consent expires
    uint256 grantedAt;        // When consent was granted
    bool revoked;             // Has consent been revoked?
}

Mapping: consents
    mapping(address owner => mapping(address requester => mapping(bytes32 credentialTypeHash => Consent)))

Immutable: digitalIdentityContract (address)
    Reference to DigitalIdentity contract for validation

Constants:
    uint256 MIN_CONSENT_DURATION = 1 days;
    uint256 MAX_CONSENT_DURATION = 365 days;
```

---

### Functions

#### 1. SetConsent(address requester, bytes32 credentialTypeHash, uint256 expiryTimestamp)

**Access**: Public, only registered credential owners

**Purpose**: Grant time-limited consent to a requester

**Validation**:
- Require: Caller (student) is registered (call `DigitalIdentity.IsRegistered(msg.sender)`)
- Require: Requester is registered (call `DigitalIdentity.IsRegistered(requester)`)
- Require: Credential exists (call `DigitalIdentity.GetCredentialHash(msg.sender, credentialTypeHash)` - will revert if not exists)
- Require: `expiryTimestamp > block.timestamp` (future date)
- Require: `expiryTimestamp <= block.timestamp + MAX_CONSENT_DURATION` (max 365 days)
- Require: requester != msg.sender (can't grant consent to yourself)

**Effects**:
- Create/update consent:
  ```
  consents[msg.sender][requester][credentialTypeHash] = Consent({
      exists: true,
      expiry: expiryTimestamp,
      grantedAt: block.timestamp,
      revoked: false
  })
  ```

**Interactions**:
- Emit `ConsentGranted(msg.sender, requester, credentialTypeHash, expiryTimestamp)`

**Returns**: void

**Notes**:
- Calling SetConsent again updates the expiry (consent renewal)
- Token minting happens in DataSharing contract, NOT here (separation of concerns)

---

#### 2. RevokeConsent(address requester, bytes32 credentialTypeHash)

**Access**: Public, only consent owner

**Purpose**: Revoke previously granted consent

**Validation**:
- Require: Consent exists (`consents[msg.sender][requester][credentialTypeHash].exists`)

**Effects**:
- Delete consent: `delete consents[msg.sender][requester][credentialTypeHash]`
- OR mark as revoked: `consents[msg.sender][requester][credentialTypeHash].revoked = true`
  - **Recommended**: Delete (saves gas on future reads, automatic storage refund)

**Interactions**:
- Emit `ConsentRevoked(msg.sender, requester, credentialTypeHash, block.timestamp)`

**Returns**: void

---

#### 3. CheckConsent(address owner, address requester, bytes32 credentialTypeHash) returns (bool)

**Access**: Public view

**Purpose**: Check if consent is valid (exists, not expired, not revoked)

**Logic**:
```
Consent memory c = consents[owner][requester][credentialTypeHash];

if (!c.exists) return false;
if (c.revoked) return false;
if (block.timestamp >= c.expiry) return false;

return true;
```

**Returns**: true if valid, false otherwise

**Notes**: Used by DataSharing contract before granting access

---

#### 4. GetConsentExpiry(address owner, address requester, bytes32 credentialTypeHash) returns (uint256)

**Access**: Public view

**Purpose**: Get expiry timestamp of a consent

**Validation**:
- Require: Consent exists

**Returns**: `expiry` timestamp (uint256)

---

### Events

```
event ConsentGranted(
    address indexed owner,
    address indexed requester,
    bytes32 indexed credentialTypeHash,
    uint256 expiry,
    uint256 timestamp
);

event ConsentRevoked(
    address indexed owner,
    address indexed requester,
    bytes32 indexed credentialTypeHash,
    uint256 timestamp
);
```

---

### Security Considerations

| Risk | Mitigation |
|------|------------|
| Consent front-running | Not a concern (owner controls consent, not requester) |
| Expired consent not cleaned up | Checked on-demand (gas-efficient) |
| Requester impersonation | Consent tied to requester address |
| Time manipulation | Use `block.timestamp` (secure enough for day-level granularity) |
| Consent to non-existent credential | Validated via DigitalIdentity contract call |

---

## Contract 3: DataSharing.sol

### Purpose
Orchestrates access control, audit logging, and token rewards. This is the main contract users interact with for data access.

### Responsibilities
- Verify consent before granting access
- Retrieve credential hashes from DigitalIdentity
- Log all access attempts (success and failure)
- Mint reward tokens when consent is granted
- Emit access events

---

### State Variables

```
Struct: AccessLog {
    address owner;
    address requester;
    bytes32 credentialTypeHash;
    uint256 timestamp;
    bool granted;             // true = GRANTED, false = DENIED
}

Mapping: accessLogs (optional - can use events instead)
    mapping(uint256 logId => AccessLog)
    uint256 nextLogId;

Immutable: digitalIdentityContract (IDigitalIdentity)
Immutable: consentManagerContract (IConsentManager)
Immutable: rewardTokenContract (IRewardToken or ERC20)

Constants:
    uint256 REWARD_PER_CONSENT = 10 * 10**18;  // 10 tokens (18 decimals)
```

---

### Functions

#### 1. GrantConsentAndReward(address requester, bytes32 credentialTypeHash, uint256 expiryTimestamp)

**Access**: Public, only registered students

**Purpose**: Wrapper function that grants consent AND mints reward tokens (combines ConsentManager + token logic)

**Validation**:
- All validations from `ConsentManager.SetConsent()`

**Effects**:
1. Call `ConsentManager.SetConsent(requester, credentialTypeHash, expiryTimestamp)`
2. Mint tokens: `rewardToken.mint(msg.sender, REWARD_PER_CONSENT)`

**Interactions**:
- Emit `TokensRewarded(msg.sender, REWARD_PER_CONSENT)`

**Returns**: void

**Notes**:
- This is the function students call (not ConsentManager directly)
- Follows Checks-Effects-Interactions pattern

---

#### 2. RevokeConsentWrapper(address requester, bytes32 credentialTypeHash)

**Access**: Public, only consent owner

**Purpose**: Wrapper for consent revocation (for consistency)

**Effects**:
- Call `ConsentManager.RevokeConsent(requester, credentialTypeHash)`

**Returns**: void

**Notes**: Tokens are NOT reclaimed

---

#### 3. AccessData(address owner, bytes32 credentialTypeHash) returns (bytes32)

**Access**: Public, only authorized requesters

**Purpose**: Access a credential hash if consent is valid

**Validation (CHECKS)**:
1. Check consent: `require(ConsentManager.CheckConsent(owner, msg.sender, credentialTypeHash), "Consent invalid or expired")`

**Effects (EFFECTS)**:
2. Log access (success):
   - Option A: Store in mapping: `accessLogs[nextLogId++] = AccessLog({...})`
   - Option B: Only emit event (gas-efficient) ← **Recommended**

**Interactions (INTERACTIONS)**:
3. Retrieve credential hash: `bytes32 hash = DigitalIdentity.GetCredentialHash(owner, credentialTypeHash)`
4. Emit `AccessGranted(owner, msg.sender, credentialTypeHash, hash, block.timestamp)`

**Returns**: `credentialHash` (bytes32)

**Error Handling**: If consent check fails, revert with custom error:
```
error ConsentInvalid();
error ConsentExpired();
error ConsentNotFound();
```

---

#### 4. LogDeniedAccess(address owner, bytes32 credentialTypeHash, string reason) [INTERNAL]

**Access**: Internal, called when access is denied

**Purpose**: Log failed access attempts

**Effects**:
- Emit `AccessDenied(owner, msg.sender, credentialTypeHash, reason, block.timestamp)`
- Optionally store in `accessLogs` mapping

**Notes**: Called from try-catch or require failures

---

### Events

```
event AccessGranted(
    address indexed owner,
    address indexed requester,
    bytes32 indexed credentialTypeHash,
    bytes32 credentialHash,
    uint256 timestamp
);

event AccessDenied(
    address indexed owner,
    address indexed requester,
    bytes32 indexed credentialTypeHash,
    string reason,
    uint256 timestamp
);

event TokensRewarded(
    address indexed recipient,
    uint256 amount,
    uint256 timestamp
);
```

---

### Security Considerations

| Risk | Mitigation |
|------|------------|
| Reentrancy on token mint | Use ReentrancyGuard (OpenZeppelin) |
| Failed credential retrieval | Wrap in require/try-catch |
| Gas griefing (logging) | Use events instead of storage |
| Unauthorized access | Consent check BEFORE retrieving data |
| Front-running | Not applicable (consent is pre-existing) |

---

## Contract Interaction Diagram (Text-Based UML)

```
┌─────────────────────┐
│   DigitalIdentity   │
├─────────────────────┤
│ - users             │
│ - credentials       │
├─────────────────────┤
│ + RegisterUser()    │
│ + StoreCredential() │
│ + GetCredentialHash()│
│ + IsRegistered()    │
└──────────┬──────────┘
           │
           │ (read-only calls)
           │
           ↓
┌─────────────────────┐         ┌─────────────────────┐
│   ConsentManager    │←────────│    DataSharing      │
├─────────────────────┤ (calls) ├─────────────────────┤
│ - consents          │         │ - accessLogs        │
├─────────────────────┤         ├─────────────────────┤
│ + SetConsent()      │         │ + GrantConsentAnd   │
│ + RevokeConsent()   │         │   Reward()          │
│ + CheckConsent()    │         │ + AccessData()      │
│ + GetConsentExpiry()│         │ + RevokeConsentWrap()│
└─────────────────────┘         └──────────┬──────────┘
                                           │
                                           │ (minting)
                                           ↓
                                ┌─────────────────────┐
                                │   RewardToken (ERC20)│
                                ├─────────────────────┤
                                │ - balances          │
                                ├─────────────────────┤
                                │ + mint()            │
                                │ + transfer()        │
                                │ + balanceOf()       │
                                └─────────────────────┘

Arrows indicate: Contract A calls Contract B
```

---

## Function Call Flow Example

### Scenario: Student grants consent and employer accesses credential

```
1. Student calls DataSharing.GrantConsentAndReward(employerAddr, "Bachelor_Diploma", expiry)
   │
   ├─→ Checks: DigitalIdentity.IsRegistered(student)
   ├─→ Checks: DigitalIdentity.IsRegistered(employer)
   ├─→ Checks: DigitalIdentity.GetCredentialHash(student, "Bachelor_Diploma") (exists)
   ├─→ Checks: expiry validation
   │
   ├─→ Effects: ConsentManager.SetConsent(employer, "Bachelor_Diploma", expiry)
   │            └─→ Stores consent in mapping
   │            └─→ Emits ConsentGranted event
   │
   └─→ Interactions: RewardToken.mint(student, 10 tokens)
                     └─→ Emits TokensRewarded event

2. Employer calls DataSharing.AccessData(studentAddr, "Bachelor_Diploma")
   │
   ├─→ Checks: ConsentManager.CheckConsent(student, employer, "Bachelor_Diploma")
   │            └─→ consent exists?
   │            └─→ not revoked?
   │            └─→ not expired?
   │            └─→ returns true
   │
   ├─→ Effects: Emit AccessGranted event
   │
   └─→ Interactions: DigitalIdentity.GetCredentialHash(student, "Bachelor_Diploma")
                     └─→ returns credentialHash
                     └─→ DataSharing returns hash to employer
```

---

## Interface Definitions (For Contract Communication)

### IDigitalIdentity

```
interface IDigitalIdentity {
    function RegisterUser(bytes32 idHash, bytes32 emailHash, bytes32 studentIdHash) external;
    function StoreCredential(bytes32 credentialTypeHash, bytes32 credentialHash) external;
    function GetCredentialHash(address owner, bytes32 credentialTypeHash) external view returns (bytes32);
    function IsRegistered(address user) external view returns (bool);
}
```

---

### IConsentManager

```
interface IConsentManager {
    function SetConsent(address requester, bytes32 credentialTypeHash, uint256 expiryTimestamp) external;
    function RevokeConsent(address requester, bytes32 credentialTypeHash) external;
    function CheckConsent(address owner, address requester, bytes32 credentialTypeHash) external view returns (bool);
    function GetConsentExpiry(address owner, address requester, bytes32 credentialTypeHash) external view returns (uint256);
}
```

---

### IRewardToken (ERC20)

```
interface IRewardToken {
    function mint(address to, uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}
```

---

## Gas Optimization Strategies

| Optimization | Where Applied | Savings |
|--------------|---------------|---------|
| Use `bytes32` for hashes | All contracts | ~30% vs strings |
| Use `mapping` over `array` | All contracts | O(1) vs O(n) |
| Use `immutable` for contract refs | DataSharing | ~2100 gas/read |
| Use events instead of storage for logs | DataSharing | ~5000 gas/log |
| Delete instead of marking revoked | ConsentManager | Gas refund |
| Batch operations (future) | All contracts | Amortized cost |
| Short revert strings or custom errors | All contracts | ~20 gas/revert |

---

## Security Checklist

### Checks-Effects-Interactions Pattern
- All validations (checks) BEFORE state changes
- All state changes (effects) BEFORE external calls
- All external calls (interactions) LAST

### Access Control
- `require(users[msg.sender].exists)` for registration checks
- `require(consent.owner == msg.sender)` for consent revocation
- `onlyOwner` for admin functions (if any)

### Reentrancy Protection
- Use OpenZeppelin's `ReentrancyGuard` on:
  - `GrantConsentAndReward()` (token minting)
  - `AccessData()` (if storing logs on-chain)

### Input Validation
- Require non-zero addresses
- Require non-zero bytes32 hashes
- Require future timestamps for expiry
- Require duration within allowed range (1-365 days)

### Integer Overflow/Underflow
- Use Solidity ^0.8.0 (built-in overflow checks)
- No need for SafeMath

### Timestamp Dependence
- Use `block.timestamp` (secure for day-level granularity)
- Miners can manipulate by ~15 seconds (acceptable for consent duration)

---

## Testing Strategy (To Be Implemented in Step 3)

### Unit Tests (One File Per Contract)

#### DigitalIdentity.t.sol
- Test user registration (success, duplicate prevention)
- Test credential storage (success, update, non-existent user)
- Test getters (IsRegistered, GetCredentialHash)
- Test events emission

#### ConsentManager.t.sol
- Test consent grant (success, expiry validation, requester validation)
- Test consent revocation (success, non-existent consent)
- Test consent expiration (time-based)
- Test CheckConsent function (all edge cases)
- Test events emission

#### DataSharing.t.sol
- Test GrantConsentAndReward (consent + token minting)
- Test AccessData (valid consent, expired consent, revoked consent, no consent)
- Test access logging (events)
- Test integration with other contracts

---

### Integration Tests
- Full workflow: Registration → Credential Storage → Consent Grant → Access → Revocation
- Cross-contract calls (DataSharing → ConsentManager → DigitalIdentity)
- Token balance checks after consent grants

---

### Gas Cost Tests
- Measure deployment costs (each contract)
- Measure function execution costs:
  - RegisterUser: ~XXX gas
  - StoreCredential: ~XXX gas
  - SetConsent: ~XXX gas
  - AccessData: ~XXX gas
- Optimize functions that exceed budget

---

## Deliverable Checklist (Step 2B)

- **3 Smart Contracts Designed**: DigitalIdentity, ConsentManager, DataSharing
- **Function Specifications**: All functions detailed with inputs, outputs, validations
- **State Variables**: All mappings and structs defined
- **Events**: All events specified
- **Interfaces**: Contract communication interfaces defined
- **Security Considerations**: Checks-Effects-Interactions, access control, reentrancy
- **Gas Optimization**: Strategies identified
- **No Code**: Design only (ready for Step 3 implementation)

**Next**: Implement contracts in Solidity (Step 3) OR create architecture diagrams (optional enhancement)