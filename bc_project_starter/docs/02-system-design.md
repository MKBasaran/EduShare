# Step 2A: Platform/System Design

## 1. Data Model Design

### 1.1 User Identity Attributes

This table defines what data is collected from users and how it's stored.

| Attribute | Example Value | On-Chain? | Off-Chain? | Hashed? | Storage Type |
|-----------|---------------|-----------|------------|---------|--------------|
| User Address | `0x742d35Cc...` | Yes | No | No | address |
| Name | "John Smith" | No | Yes | Yes (hash on-chain) | bytes32 |
| Email | "john@example.com" | No | Yes | Yes (hash on-chain) | bytes32 |
| Student ID | "S12345678" | No | Yes | Yes (hash on-chain) | bytes32 |
| University | "MIT" | Yes | No | No | string |
| Degree Type | "Bachelor of Science" | Yes | No | No | string |
| Graduation Year | 2023 | Yes | No | No | uint16 |
| Registration Timestamp | 1700000000 | Yes | No | No | uint256 |

**Why this design?**
- **Sensitive PII (name, email, student ID)**: Hashed on-chain for privacy, stored off-chain for actual use
- **Non-sensitive metadata (university, degree, year)**: Stored on-chain for verification
- **User address**: Ethereum address serves as unique identifier

---

### 1.2 Credential Data Model

This table defines how academic credentials (diploma, transcript) are stored.

| Attribute | Example Value | On-Chain? | Off-Chain? | Hashed? | Storage Type |
|-----------|---------------|-----------|------------|---------|--------------|
| Credential ID | Auto-generated | Yes | No | No | uint256 |
| Owner Address | `0x742d35Cc...` | Yes | No | No | address |
| Credential Type | "Bachelor_Diploma" | No | Yes | Yes (hash on-chain) | bytes32 |
| Credential Hash | `keccak256(diploma_pdf)` | Yes | No | N/A (already hash) | bytes32 |
| Actual Credential File | `diploma.pdf` | No | Yes | No | File |
| Issue Date | 1700000000 | Yes | No | No | uint256 |

**Why this design?**
- **Credential file (PDF/JSON)**: Stored off-chain to save gas costs and avoid blockchain bloat
- **Credential hash**: Stored on-chain for verification (proves authenticity)
- **Credential type hash**: Hashed to allow for flexible categorization

**Credential Types (examples)**:
- `keccak256("Bachelor_Diploma")`
- `keccak256("Transcript")`
- `keccak256("Master_Degree")`
- `keccak256("Certificate_Honors")`

---

### 1.3 Consent Record Model

This table defines the structure of consent records.

| Attribute | Example Value | On-Chain? | Off-Chain? | Hashed? | Storage Type |
|-----------|---------------|-----------|------------|---------|--------------|
| Owner (Student) Address | `0x742d35Cc...` | Yes | No | No | address |
| Requester (Employer) Address | `0x8c1a3B...` | Yes | No | No | address |
| Credential Type Hash | `keccak256("Transcript")` | Yes | No | N/A | bytes32 |
| Expiry Timestamp | 1705000000 | Yes | No | No | uint256 |
| Grant Timestamp | 1700000000 | Yes | No | No | uint256 |
| Revoked? | false | Yes | No | No | bool |
| Exists? | true | Yes | No | No | bool |

**Why this design?**
- **All data on-chain**: Consent is critical for access control, must be verifiable on-chain
- **Nested mapping structure**: `mapping(address owner => mapping(address requester => mapping(bytes32 credentialType => Consent)))`
- **Efficient lookups**: O(1) to check if consent exists

**Consent Duration Rules**:
- Minimum: 1 day (86400 seconds)
- Maximum: 365 days (31536000 seconds)
- Validation: `require(expiryTimestamp > block.timestamp && expiryTimestamp <= block.timestamp + 365 days)`

---

### 1.4 Access Log Model

This table defines what data is logged for each access attempt via events.

| Attribute | Example Value | Logged in Event? | Storage Type |
|-----------|---------------|------------------|--------------|
| Owner (Student) Address | `0x742d35Cc...` | Yes (indexed) | address |
| Requester Address | `0x8c1a3B...` | Yes (indexed) | address |
| Credential Type Hash | `keccak256("Diploma")` | Yes (indexed) | bytes32 |
| Credential Hash | `0xabc123...` | Yes (if granted) | bytes32 |
| Access Timestamp | 1702000000 | Yes | uint256 |
| Access Result | GRANTED / DENIED | Yes (event type) | N/A |
| Failure Reason (if denied) | "ConsentExpired" | Yes | string |

**Why this design?**
- **Event-based logging**: Audit trail is immutable and permanently stored in transaction logs
- **Gas-efficient**: Events cost ~375 gas per log entry + ~375 gas per indexed topic
- **Indexed parameters**: Owner, requester, and credential type are indexed for efficient filtering
- **Off-chain queryable**: Events can be filtered and queried via RPC calls (ethers.js, viem, etc.)

**Event-Based Approach Benefits**:
| Benefit | Explanation |
|---------|-------------|
| **Gas-efficient** | ~8k gas per log vs ~200k for storage arrays |
| **Permanent** | Events are part of transaction receipts, stored forever on blockchain |
| **Indexed** | First 3 parameters are indexed topics for efficient filtering |
| **No storage bloat** | Doesn't increase contract storage size |

**Implementation Choice**: We chose events-only approach for 83% gas savings. AccessData costs ~43k gas instead of ~260k. Events provide permanent audit trail queryable off-chain, which is sufficient for compliance and transparency needs.

---

### 1.5 Token Reward Model

This table defines the token incentive system.

| Attribute | Example Value | On-Chain? | Off-Chain? | Hashed? | Storage Type |
|-----------|---------------|-----------|------------|---------|--------------|
| Token Name | "EduShareToken" | Yes | No | No | string |
| Token Symbol | "EDUSHARE" | Yes | No | No | string |
| Decimals | 18 | Yes | No | No | uint8 |
| Reward per Consent | 10 tokens | Yes | No | No | uint256 |
| Total Supply | Unlimited (minted) | Yes | No | No | uint256 |
| User Balance | 50 tokens | Yes | No | No | mapping |

**Why this design?**
- **ERC20 standard**: Use OpenZeppelin ERC20 for compatibility
- **Mint on consent grant**: New tokens created when student grants consent
- **No burn on revocation**: Students keep tokens even after revoking
- **Transferable**: Students can transfer/trade tokens
- **No access rights**: Tokens are rewards only, not access keys

**Token Economics**:
- 1 consent grant = 10 tokens (configurable by owner)
- Tokens do NOT expire
- Tokens do NOT grant data access (consent does)

---

## 2. Consent Model Design

### 2.1 Consent Lifecycle

```
[NO CONSENT]
     │
     │ Student calls SetConsent()
     ↓
[ACTIVE CONSENT]
     │
     ├──→ Expires (timestamp > expiry) ──→ [EXPIRED] ──→ Access denied
     │
     └──→ Student calls RevokeConsent() ──→ [REVOKED] ──→ Access denied
```

---

### 2.2 Consent Specification Table

| Aspect | Specification |
|--------|---------------|
| **Who can grant?** | Only credential owner (student) |
| **Who can revoke?** | Only credential owner (student) |
| **Who can access with consent?** | Only the specified requester address |
| **Consent duration** | 1 - 365 days (specified as Unix timestamp) |
| **Consent expiration** | Automatic (checked on access via `block.timestamp`) |
| **Consent renewal** | Yes (call `SetConsent()` again to update expiry) |
| **Multiple consents** | Yes (different requesters, different credentials) |
| **Consent transfer** | No (tied to specific requester address) |

---

### 2.3 Consent Workflows (Pseudocode)

#### Workflow 1: Grant Consent

```
function SetConsent(requesterAddress, credentialTypeHash, expiryTimestamp):
    // Validation
    require(isRegistered(msg.sender), "Student not registered")
    require(isRegistered(requesterAddress), "Requester not registered")
    require(credentialExists(msg.sender, credentialTypeHash), "Credential not found")
    require(expiryTimestamp > block.timestamp, "Expiry must be in future")
    require(expiryTimestamp <= block.timestamp + 365 days, "Max 365 days")

    // Create consent
    consents[msg.sender][requesterAddress][credentialTypeHash] = Consent({
        exists: true,
        expiry: expiryTimestamp,
        grantedAt: block.timestamp,
        revoked: false
    })

    // Mint reward tokens
    mint(msg.sender, REWARD_AMOUNT)  // e.g., 10 tokens

    // Emit event
    emit ConsentGranted(msg.sender, requesterAddress, credentialTypeHash, expiryTimestamp)
```

---

#### Workflow 2: Revoke Consent

```
function RevokeConsent(requesterAddress, credentialTypeHash):
    // Validation
    require(consents[msg.sender][requesterAddress][credentialTypeHash].exists, "Consent does not exist")

    // Delete consent (or mark as revoked)
    delete consents[msg.sender][requesterAddress][credentialTypeHash]
    // OR
    consents[msg.sender][requesterAddress][credentialTypeHash].revoked = true

    // Note: Tokens are NOT reclaimed

    // Emit event
    emit ConsentRevoked(msg.sender, requesterAddress, credentialTypeHash, block.timestamp)
```

---

#### Workflow 3: Check Consent Validity

```
function isConsentValid(owner, requester, credentialTypeHash) returns (bool):
    Consent memory c = consents[owner][requester][credentialTypeHash]

    if (!c.exists) return false
    if (c.revoked) return false
    if (block.timestamp >= c.expiry) return false

    return true
```

---

### 2.4 Consent Expiration Logic

**Question**: What happens when consent expires?

**Answer**:
- Consent automatically becomes invalid when `block.timestamp >= expiry`
- No automatic cleanup (gas cost)
- Checked on-demand during `AccessData()` call
- Student can grant new consent after expiration

**Implementation**:
```solidity
require(block.timestamp < consent.expiry, "Consent expired");
```

---

## 3. Audit Log Design

### 3.1 Events to Log

All access attempts (success and failure) must be logged.

| Event Name | Parameters | When Emitted |
|------------|------------|--------------|
| `ConsentGranted` | `(address indexed owner, address indexed requester, bytes32 credentialType, uint256 expiry)` | When consent is granted |
| `ConsentRevoked` | `(address indexed owner, address indexed requester, bytes32 credentialType, uint256 timestamp)` | When consent is revoked |
| `AccessGranted` | `(address indexed owner, address indexed requester, bytes32 credentialType, bytes32 credentialHash, uint256 timestamp)` | When access succeeds |
| `AccessDenied` | `(address indexed owner, address indexed requester, bytes32 credentialType, string reason, uint256 timestamp)` | When access fails |
| `CredentialStored` | `(address indexed owner, bytes32 credentialType, bytes32 credentialHash)` | When credential is added |
| `IdentityRegistered` | `(address indexed user, bytes32 idHash)` | When user registers |

---

### 3.2 Audit Log Queries

Students and requesters should be able to query their relevant logs.

| User Type | Query | How to Get Data |
|-----------|-------|-----------------|
| Student | "Who accessed my credentials?" | Filter `AccessGranted` events by `owner == studentAddress` |
| Student | "Who tried to access but failed?" | Filter `AccessDenied` events by `owner == studentAddress` |
| Requester | "What credentials did I access?" | Filter `AccessGranted` events by `requester == myAddress` |
| Requester | "What access attempts failed?" | Filter `AccessDenied` events by `requester == myAddress` |

**Implementation**: Use event filtering with web3 libraries

---

### 3.3 Log Immutability

**Can logs be deleted?** NO

**Can logs be modified?** NO

**Why?**
- Events are part of blockchain transaction receipts
- Once block is confirmed, events are permanent
- Provides trustless audit trail

**Security**:
- Even if consent is revoked, previous access logs remain
- Prevents covering tracks of unauthorized access attempts

---

## 4. Data Flow Diagrams

### 4.1 Complete Data Flow (Student Registration → Access)

```
[STUDENT]
    │
    │ 1. Register (name_hash, email_hash, studentID_hash)
    ↓
[DigitalIdentity Contract]
    │ stores: users[studentAddress] = {idHash, emailHash, studentIdHash}
    │ emits: IdentityRegistered(studentAddress, idHash)
    │
[STUDENT]
    │
    │ 2. Store Credential (credentialType_hash, credential_hash)
    ↓
[DigitalIdentity Contract]
    │ stores: credentials[studentAddress][credentialTypeHash] = credentialHash
    │ emits: CredentialStored(student, credentialType, credentialHash)
    │
[EMPLOYER] ──(off-chain request)──> [STUDENT]
    │
    │ 3. Grant Consent (employerAddress, credentialType, expiry)
    ↓
[ConsentManager Contract]
    │ stores: consents[student][employer][credentialType] = Consent{expiry, ...}
    │ mints: 10 tokens to student
    │ emits: ConsentGranted(student, employer, credentialType, expiry)
    │
[EMPLOYER]
    │
    │ 4. Access Data (studentAddress, credentialType)
    ↓
[DataSharing Contract]
    │ checks: ConsentManager.isConsentValid(student, employer, credentialType)
    │ retrieves: DigitalIdentity.getCredentialHash(student, credentialType)
    │ logs: AccessGranted event
    │ returns: credentialHash
    │
[EMPLOYER]
    │
    │ 5. Fetch actual credential file using hash
    ↓
[Off-Chain Storage] (Local Files)
    │ returns: diploma.pdf
    │
[EMPLOYER]
    │ 6. Verify hash matches file content
```

---

### 4.2 Off-Chain vs On-Chain Data Storage

```
┌─────────────────────────────────────────────────────────────┐
│                        OFF-CHAIN                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  • Actual credential files (diploma.pdf, transcript.json)  │
│  • Plaintext PII (name, email, student ID)                 │
│  • Large data (images, scanned documents)                  │
│  • User profile photos                                     │
│                                                             │
│  Storage: Local files                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘

                            │
                            │ Linked by hash (keccak256)
                            ↓

┌─────────────────────────────────────────────────────────────┐
│                        ON-CHAIN                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  • Hashes of PII (name_hash, email_hash, studentID_hash)   │
│  • Credential hashes (keccak256(diploma_pdf))              │
│  • Consent records (who, what, when, expiry)               │
│  • Access logs (events)                                    │
│  • Token balances                                          │
│  • Metadata (university, degree, year)                     │
│                                                             │
│  Why on-chain?                                             │
│    - Immutable                                             │
│    - Verifiable                                            │
│    - No trusted third party                                │
│    - Decentralized                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Security Considerations

### 5.1 Data Privacy

| Data Type | Storage | Why? |
|-----------|---------|------|
| Name, Email, Student ID | Hashed on-chain, plaintext off-chain | Privacy: No PII on public blockchain |
| Credential files | Off-chain only | Cost: Too large for blockchain |
| Credential hashes | On-chain | Verification: Prove file authenticity |
| Consent records | On-chain | Security: Access control must be decentralized |
| Access logs | On-chain (events) | Audit: Immutable trail |

---

### 5.2 Access Control Rules

| Check | Why? |
|-------|------|
| Only credential owner can grant consent | Prevent unauthorized sharing |
| Only credential owner can revoke consent | Prevent others from locking access |
| Only registered users can participate | Prevent spam/abuse |
| Consent must not be expired | Time-limited access |
| Requester must match consent record | Prevent impersonation |
| Credential must exist before granting consent | Data integrity |

---

## 6. Summary Tables

### 6.1 Data Storage Summary

| Data Category | On-Chain | Off-Chain | Hashed | Why? |
|---------------|----------|-----------|--------|------|
| User identity (name, email, ID) | Hash only | Plaintext | Yes | Privacy |
| Credentials (diploma PDF) | Hash only | Full file | Yes | Cost + Privacy |
| Consent records | Full data | - | No | Access control |
| Access logs | Events | - | No | Audit trail |
| Tokens | Balances | - | No | Rewards |
| Metadata (university, degree) | Full data | - | No | Public info |

---

### 6.2 Consent Duration Validation

| Rule | Validation |
|------|------------|
| Minimum duration | 1 day (86400 seconds) |
| Maximum duration | 365 days (31536000 seconds) |
| Expiry must be future | `expiryTimestamp > block.timestamp` |
| Check on access | `block.timestamp < consent.expiry` |

---

## 7. Deliverable Checklist (Step 2A)

- **Data Model**: 5 tables defined (Identity, Credential, Consent, Audit Log, Token)
- **On-Chain vs Off-Chain**: Table showing what goes where
- **Consent Model**: Lifecycle, workflows, expiration logic
- **Audit Log**: Events, queries, immutability guarantee
- **Data Flow**: Diagrams showing end-to-end flow
- **Security**: Access control and privacy considerations

**Next**: Proceed to Step 2B - Smart Contract Design (3 contracts, function signatures, no code)
