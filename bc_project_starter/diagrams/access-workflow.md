# Data Access Workflow Diagrams

## 1. Successful Access (Valid Consent)

```mermaid
sequenceDiagram
    participant Requester as Requester/Employer
    participant DataSharing
    participant ConsentMgr as ConsentManager
    participant Identity as DigitalIdentity
    participant LocalStorage as Local Files

    Note over Requester: Requester wants to access student's Bachelor Diploma

    Requester->>DataSharing: AccessData(studentAddress, keccak256("Bachelor_Diploma"))

    Note over DataSharing: CHECKS - Phase 1: Consent Validation

    DataSharing->>ConsentMgr: CheckConsent(student, requester, credType)
    activate ConsentMgr
    Note over ConsentMgr: Checks:<br/>- Consent exists? YES<br/>- Consent revoked? NO<br/>- timestamp < expiry? YES
    ConsentMgr-->>DataSharing: true (Consent is valid)
    deactivate ConsentMgr

    Note over DataSharing: EFFECTS - Phase 2: Logging

    DataSharing->>DataSharing: Emit AccessGranted event

    Note over DataSharing: INTERACTIONS - Phase 3: Retrieve Data

    DataSharing->>Identity: GetCredentialHash(student, credType)
    activate Identity
    Identity-->>DataSharing: credentialHash (0xabc123...def456)
    deactivate Identity

    DataSharing-->>Requester: credentialHash

    Note over Requester: Transaction successful

    Requester->>LocalStorage: Fetch file using hash
    LocalStorage-->>Requester: diploma.pdf

    Note over Requester: Verify integrity:<br/>keccak256(diploma.pdf) == credentialHash<br/>→ File is authentic!
```

---

## 2. Access Denied - Expired Consent

```mermaid
sequenceDiagram
    participant Requester as Requester/Employer
    participant DataSharing
    participant ConsentMgr as ConsentManager

    Requester->>DataSharing: AccessData(studentAddr, credType)

    Note over DataSharing: CHECKS: Consent validation

    DataSharing->>ConsentMgr: CheckConsent(student, requester, credType)
    activate ConsentMgr
    Note over ConsentMgr: Checks:<br/>- Consent exists? YES<br/>- Consent revoked? NO<br/>- timestamp < expiry? NO (EXPIRED!)
    ConsentMgr-->>DataSharing: false
    deactivate ConsentMgr

    Note over DataSharing: Consent check failed

    DataSharing->>DataSharing: Emit AccessDenied(reason: "Consent expired")

    DataSharing-->>Requester: Transaction REVERTS

    Note over Requester: Error: "Consent expired"<br/>Requester must contact student<br/>to renew consent
```

---

## 3. Access Denied - Revoked Consent

```mermaid
sequenceDiagram
    participant Requester as Requester/Employer
    participant DataSharing
    participant ConsentMgr as ConsentManager

    Note over ConsentMgr: Timeline:<br/>Day 1: Student grants consent (30 days)<br/>Day 5: Student revokes consent<br/>Day 6: Employer tries to access

    Requester->>DataSharing: AccessData(studentAddr, credType)

    DataSharing->>ConsentMgr: CheckConsent(student, employer, credType)
    activate ConsentMgr
    Note over ConsentMgr: Checks:<br/>- Consent exists? NO (was deleted)
    ConsentMgr-->>DataSharing: false
    deactivate ConsentMgr

    DataSharing->>DataSharing: Emit AccessDenied(reason: "Consent revoked")

    DataSharing-->>Requester: Transaction REVERTS

    Note over Requester: ACCESS DENIED
```

---

## 4. Access Denied - No Consent Ever Granted

```mermaid
sequenceDiagram
    participant Requester as Requester/Employer
    participant DataSharing
    participant ConsentMgr as ConsentManager

    Note over Requester: Scenario: Requester tries to access<br/>without permission

    Requester->>DataSharing: AccessData(studentAddr, credType)

    DataSharing->>ConsentMgr: CheckConsent(student, requester, credType)
    activate ConsentMgr
    Note over ConsentMgr: Checks:<br/>- Consent exists? NO (never granted)
    ConsentMgr-->>DataSharing: false
    deactivate ConsentMgr

    DataSharing->>DataSharing: Emit AccessDenied(reason: "No consent")

    DataSharing-->>Requester: Transaction REVERTS

    Note over Requester: ⚠️ This attempt is logged!<br/>Student can see unauthorized access attempts
```

---

## 5. Decision Tree: Access Control Logic

```mermaid
flowchart TD
    Start([Requester calls AccessData]) --> CheckExists{Does consent exist?}

    CheckExists -->|NO| DenyNoConsent[DENY<br/>Reason: No consent]
    CheckExists -->|YES| CheckRevoked{Is consent revoked?}

    CheckRevoked -->|YES| DenyRevoked[DENY<br/>Reason: Revoked]
    CheckRevoked -->|NO| CheckExpired{Is consent expired?<br/>timestamp >= expiry}

    CheckExpired -->|YES| DenyExpired[DENY<br/>Reason: Expired]
    CheckExpired -->|NO| Grant[GRANT ACCESS]

    Grant --> LogAccess[1. Log access<br/>2. Get credential hash<br/>3. Return hash]

    style Grant fill:#4CAF50
    style DenyNoConsent fill:#f44336
    style DenyRevoked fill:#f44336
    style DenyExpired fill:#f44336
```

---

## 6. Complete Access Flow Sequence

```mermaid
sequenceDiagram
    participant Requester
    participant DataSharing
    participant ConsentMgr as ConsentManager
    participant Identity as DigitalIdentity
    participant LocalStorage as Local Files

    Requester->>DataSharing: 1. AccessData(student, credType)

    DataSharing->>ConsentMgr: 2. CheckConsent(student, requester, credType)

    Note over ConsentMgr: 3. Read consent mapping<br/>Check exists, revoked, expiry

    alt Consent Invalid
        ConsentMgr-->>DataSharing: false
        DataSharing->>DataSharing: 4. Emit AccessDenied
        DataSharing-->>Requester: 5. Revert with error
    else Consent Valid
        ConsentMgr-->>DataSharing: true
        DataSharing->>DataSharing: 4. Emit AccessGranted
        DataSharing->>Identity: 5. GetCredentialHash(student, credType)
        Identity-->>DataSharing: credHash
        DataSharing-->>Requester: credHash

        Requester->>LocalStorage: 6. Fetch file using hash
        LocalStorage-->>Requester: diploma.pdf

        Note over Requester: 7. Verify hash matches<br/>keccak256(file) == credHash<br/>✓ Success
    end
```

---

## 7. Access Logging (Audit Trail)

### Event Structure

```solidity
event AccessGranted(
    address indexed owner,       // Student who owns credential
    address indexed requester,   // Employer who accessed
    bytes32 indexed credentialTypeHash,
    bytes32 credentialHash,      // Hash returned
    uint256 timestamp            // When accessed
);

event AccessDenied(
    address indexed owner,
    address indexed requester,
    bytes32 indexed credentialTypeHash,
    string reason,               // "Expired", "Revoked", "No consent"
    uint256 timestamp
);
```

---

## 8. Querying Audit Logs

### Student's Perspective: "Who accessed my credentials?"

```javascript
// Using Viem.js or Ethers.js

// Get all successful accesses
const accessGrantedLogs = await contract.queryFilter(
  contract.filters.AccessGranted(studentAddress, null, null)
);

// Get all denied attempts
const accessDeniedLogs = await contract.queryFilter(
  contract.filters.AccessDenied(studentAddress, null, null)
);

// Results:
[
  {
    owner: "0xStudent...",
    requester: "0xEmployerA...",
    credentialType: "0xBachelorDiploma...",
    timestamp: 1700000000,
    status: "GRANTED"
  },
  {
    owner: "0xStudent...",
    requester: "0xEmployerB...",
    credentialType: "0xTranscript...",
    reason: "No consent",
    timestamp: 1700001000,
    status: "DENIED"
  }
]
```

---

### Requester's Perspective: "What credentials did I access?"

```javascript
// Get all my access attempts
const myAccessLogs = await contract.queryFilter(
  contract.filters.AccessGranted(null, requesterAddress, null)
);

// Results:
[
  {
    owner: "0xStudent1...",
    requester: "0xMyAddress...",
    credentialType: "0xBachelorDiploma...",
    credentialHash: "0xabc123...",
    timestamp: 1700000000
  },
  {
    owner: "0xStudent2...",
    requester: "0xMyAddress...",
    credentialType: "0xMasterDegree...",
    credentialHash: "0xdef456...",
    timestamp: 1700002000
  }
]
```

---

## 9. Security Considerations

### Authorization
- Only requester with valid consent can access
- Consent tied to specific requester address (no impersonation)
- Consent tied to specific credential type (granular control)

### Time-Based Access Control
- Automatic expiration (no cron jobs needed)
- Checked on-demand (gas-efficient)
- No grace period (strict expiry)

### Audit Trail
- Every access logged (success and failure)
- Logs are immutable (events on blockchain)
- Students can detect unauthorized attempts
- Compliance-ready (GDPR, HIPAA principles)

### Data Privacy
- Only hash returned on-chain
- Actual file stored off-chain
- Hash verification prevents tampering

---

## 10. Edge Cases

### Case 1: Credential Deleted After Consent Granted

```mermaid
sequenceDiagram
    participant Student
    participant Employer
    participant DataSharing
    participant Identity as DigitalIdentity

    Note over Student,Employer: Day 1: Student grants consent<br/>Day 2: Student stores credential<br/>Day 3: Student deletes credential (if allowed)<br/>Day 4: Employer tries to access

    Employer->>DataSharing: AccessData(student, credType)
    DataSharing->>DataSharing: Check consent: VALID
    DataSharing->>Identity: GetCredentialHash(student, credType)
    Identity-->>DataSharing: ERROR: Credential not found
    DataSharing-->>Employer: Transaction REVERTS

    Note over Employer: "Credential does not exist"
```

**Mitigation**: Don't allow credential deletion, only updates.

---

### Case 2: Simultaneous Access from Multiple Requesters

```mermaid
flowchart LR
    EmployerA[Employer A] --> DataSharing
    EmployerB[Employer B] --> DataSharing
    DataSharing --> Result{Both have<br/>valid consent}
    Result -->|Yes| Success[Both transactions succeed<br/>Both receive credential hash<br/>Both logged separately<br/>No conflict - read-only operation]

    style Success fill:#4CAF50
```

**No issue**: Read operations don't conflict.

---

### Case 3: Access During Block of Expiry

```mermaid
flowchart TD
    Start[Consent expires at:<br/>timestamp 1700000000] --> Check{Current block.timestamp<br/>== 1700000000?}

    Check -->|YES| Condition[Condition:<br/>block.timestamp >= consent.expiry]
    Condition --> Result[Result: EXPIRED<br/>Access DENIED]

    Note[NOTE: Equality counts as expired]

    style Result fill:#f44336
```

---

## 11. Performance & Gas Costs

| Operation | Estimated Gas | Notes |
|-----------|---------------|-------|
| AccessData (success) | ~50,000 | 1 consent check + 1 storage read + 1 event |
| AccessData (denied) | ~30,000 | 1 consent check + 1 event (revert) |
| Event emission | ~1,500 | Per AccessGranted/AccessDenied event |
| ConsentManager.CheckConsent | ~5,000 | 3 storage reads (exists, revoked, expiry) |
| DigitalIdentity.GetCredentialHash | ~3,000 | 1 storage read |

**Optimization**: Use events instead of storage array for logs (saves ~20,000 gas per access).

---

## Summary: Access Workflow Key Points

**Successful Access**:
1. Check consent (valid, not expired, not revoked)
2. Log access (emit AccessGranted event)
3. Retrieve credential hash from DigitalIdentity
4. Return hash to requester
5. Requester fetches file off-chain
6. Requester verifies hash matches file

**Failed Access**:
- Consent expired → AccessDenied("expired")
- Consent revoked → AccessDenied("revoked")
- No consent → AccessDenied("no consent")
- All failures are logged (immutable audit trail)

**Security**:
- Checks-Effects-Interactions pattern
- Consent check BEFORE data retrieval
- All attempts logged (success and failure)
- No data returned on failure

**Privacy**:
- Only hash returned (not actual credential)
- Off-chain file verification
- Hash tampering detectable