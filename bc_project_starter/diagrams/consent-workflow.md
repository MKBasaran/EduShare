# Consent Workflow Diagrams

## 1. Grant Consent Flow

```mermaid
sequenceDiagram
    participant Student
    participant Employer
    participant DataSharing
    participant ConsentMgr as ConsentManager
    participant Identity as DigitalIdentity
    participant Token as RewardToken

    Note over Student,Employer: Off-chain request
    Employer->>Student: Request access to diploma (email/message)

    Note over Student,Token: On-chain consent grant
    Student->>DataSharing: GrantConsentAndReward(employer, credType, expiry)

    DataSharing->>Identity: IsRegistered(student)?
    Identity-->>DataSharing: true

    DataSharing->>Identity: IsRegistered(employer)?
    Identity-->>DataSharing: true

    DataSharing->>Identity: GetCredentialHash(student, credType)?
    Identity-->>DataSharing: credHash (validates exists)

    DataSharing->>ConsentMgr: SetConsent(employer, credType, expiry)
    activate ConsentMgr
    ConsentMgr->>ConsentMgr: Store consent record
    ConsentMgr->>ConsentMgr: Emit ConsentGranted event
    ConsentMgr-->>DataSharing: Success
    deactivate ConsentMgr

    DataSharing->>Token: mint(student, 10 tokens)
    activate Token
    Token->>Token: Mint tokens
    Token->>Token: Emit TokensRewarded event
    Token-->>DataSharing: Success
    deactivate Token

    DataSharing-->>Student: Transaction successful

    Note over Student: Student receives 10 tokens<br/>Consent active for specified duration
```

---

## 2. Revoke Consent Flow

```mermaid
sequenceDiagram
    participant Student
    participant DataSharing
    participant ConsentMgr as ConsentManager

    Note over Student: Student decides to revoke access

    Student->>DataSharing: RevokeConsentWrapper(employer, credType)

    DataSharing->>ConsentMgr: RevokeConsent(employer, credType)

    ConsentMgr->>ConsentMgr: Check consent exists

    alt Consent exists
        ConsentMgr->>ConsentMgr: Delete consent record
        ConsentMgr->>ConsentMgr: Emit ConsentRevoked event
        ConsentMgr-->>DataSharing: Success
        DataSharing-->>Student: Consent revoked
        Note over Student: Tokens NOT reclaimed<br/>Future access denied
    else Consent does not exist
        ConsentMgr-->>DataSharing: Revert: "Consent does not exist"
        DataSharing-->>Student: Transaction fails
    end
```

---

## 3. Consent Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> NoConsent: Initial state

    NoConsent --> Active: GrantConsent()

    Active --> Active: GrantConsent()<br/>(renew/update expiry)
    Active --> Revoked: RevokeConsent()
    Active --> Expired: Time passes<br/>(timestamp >= expiry)

    Revoked --> Active: GrantConsent()<br/>(new consent)
    Expired --> Active: GrantConsent()<br/>(new consent)

    note left of NoConsent
        No consent record exists
        Access attempts: DENIED
    end note

    note left of Active
        Consent valid
        Access attempts: GRANTED
        Student earns tokens
    end note

    note left of Revoked
        Student revoked consent
        Access attempts: DENIED
        Tokens not reclaimed
    end note

    note left of Expired
        Consent duration ended
        Access attempts: DENIED
        Automatic expiration
    end note
```

---

## 4. Consent Grant Decision Tree

```mermaid
flowchart TD
    Start([Student calls GrantConsent]) --> A{Student registered?}

    A -->|No| Fail1[Revert: Not registered]
    A -->|Yes| B{Employer registered?}

    B -->|No| Fail2[Revert: Employer not registered]
    B -->|Yes| C{Credential exists?}

    C -->|No| Fail3[Revert: Credential not found]
    C -->|Yes| D{Expiry timestamp valid?}

    D -->|Past| Fail4[Revert: Expiry must be future]
    D -->|Too far| Fail5[Revert: Max 365 days]
    D -->|Valid| E[Create consent record]

    E --> F[Mint 10 tokens to student]
    F --> G[Emit ConsentGranted event]
    G --> Success([Consent granted successfully])

    style Success fill:#4CAF50
    style Fail1 fill:#f44336
    style Fail2 fill:#f44336
    style Fail3 fill:#f44336
    style Fail4 fill:#f44336
    style Fail5 fill:#f44336
```

---

## 5. Consent Expiration Timeline

```mermaid
gantt
    title Consent Lifecycle Example (30-day consent)
    dateFormat YYYY-MM-DD
    section Consent Status
    Active Consent           :active, 2024-01-01, 30d
    Expired Consent          :crit, 2024-01-31, 10d
    section Access Rights
    Access Granted           :done, 2024-01-01, 30d
    Access Denied            :2024-01-31, 10d
```

---

## 6. Consent Renewal Flow

```mermaid
flowchart LR
    A[Consent exists<br/>Expiry: Day 30] --> B{Student calls<br/>GrantConsent again}

    B -->|Before expiry<br/>Day 20| C[Update expiry<br/>New expiry: Day 50]
    B -->|After expiry<br/>Day 35| D[Create new consent<br/>Expiry: Day 65]

    C --> E[Student receives<br/>10 more tokens]
    D --> F[Student receives<br/>10 more tokens]

    E --> G[Employer access<br/>extended]
    F --> H[Employer access<br/>restored]

    style C fill:#4CAF50
    style D fill:#4CAF50
    style E fill:#FF9800
    style F fill:#FF9800
```

---

## 7. Multiple Consent Management

```mermaid
flowchart TB
    Student[Student] --> C1[Consent to<br/>Employer A<br/>Diploma<br/>30 days]
    Student --> C2[Consent to<br/>Employer B<br/>Transcript<br/>60 days]
    Student --> C3[Consent to<br/>University C<br/>Diploma<br/>90 days]

    C1 --> T1[+10 tokens]
    C2 --> T2[+10 tokens]
    C3 --> T3[+10 tokens]

    T1 --> Total[Total: 30 tokens]
    T2 --> Total
    T3 --> Total

    style Student fill:#2196F3
    style C1 fill:#4CAF50
    style C2 fill:#4CAF50
    style C3 fill:#4CAF50
    style Total fill:#FF9800
```

**Key Point**: Each consent is independent. Student can:
- Grant different credentials to different requesters
- Set different expiry times for each
- Earn tokens for each consent grant
- Revoke any consent independently

---

## 8. Consent Validation Checks

```mermaid
flowchart TD
    Start([CheckConsent called]) --> A[Retrieve consent record]

    A --> B{Consent exists?}
    B -->|No| Deny1[Return FALSE]
    B -->|Yes| C{Revoked?}

    C -->|Yes| Deny2[Return FALSE]
    C -->|No| D{Expired?<br/>timestamp >= expiry}

    D -->|Yes| Deny3[Return FALSE]
    D -->|No| Grant[Return TRUE]

    style Grant fill:#4CAF50
    style Deny1 fill:#f44336
    style Deny2 fill:#f44336
    style Deny3 fill:#f44336
```

---

## 9. Edge Cases Handling

### Case 1: Granting consent to self

```mermaid
sequenceDiagram
    participant Student
    participant DataSharing

    Student->>DataSharing: GrantConsent(myself, credType, expiry)
    DataSharing->>DataSharing: Check: requester != msg.sender
    DataSharing-->>Student: Revert: "Cannot grant to yourself"
```

### Case 2: Duplicate consent (overwrite)

```mermaid
sequenceDiagram
    participant Student
    participant ConsentMgr

    Note over Student,ConsentMgr: Day 1: First consent
    Student->>ConsentMgr: SetConsent(employer, diploma, Day 30)
    ConsentMgr->>ConsentMgr: Create consent record

    Note over Student,ConsentMgr: Day 15: Update consent
    Student->>ConsentMgr: SetConsent(employer, diploma, Day 60)
    ConsentMgr->>ConsentMgr: Overwrite existing consent
    ConsentMgr->>ConsentMgr: New expiry: Day 60

    Note over Student: Student receives 10 more tokens<br/>(new grant = new reward)
```

### Case 3: Revoking non-existent consent

```mermaid
sequenceDiagram
    participant Student
    participant ConsentMgr

    Student->>ConsentMgr: RevokeConsent(employer, credType)
    ConsentMgr->>ConsentMgr: Check consent exists
    ConsentMgr-->>Student: Revert: "Consent does not exist"

    Note over Student: Cannot revoke what doesn't exist
```

---

## 10. Consent Data Structure

```mermaid
erDiagram
    CONSENT {
        address owner
        address requester
        bytes32 credentialTypeHash
        uint256 expiry
        uint256 grantedAt
        bool exists
        bool revoked
    }

    STUDENT ||--o{ CONSENT : grants
    REQUESTER ||--o{ CONSENT : receives
    CREDENTIAL ||--|| CONSENT : references
```

**Mapping Structure**:
```
mapping(
    address owner =>
    mapping(
        address requester =>
        mapping(
            bytes32 credentialType => Consent
        )
    )
) consents;
```

---

## Summary: Consent Workflow Key Points

**Grant Consent**:
- Student controls who accesses what
- Time-limited (1-365 days)
- Earns 10 tokens per grant
- Can update/renew anytime

**Revoke Consent**:
- Immediate effect
- Tokens not reclaimed
- Past logs remain

**Expiration**:
- Automatic (timestamp-based)
- No gas cost for expiration
- Can renew after expiry

**Security**:
- Only owner can grant/revoke
- Cross-contract validation
- Immutable audit trail
