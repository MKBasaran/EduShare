# System Architecture Diagrams

## 1. High-Level System Architecture

```mermaid
flowchart TB
    Student[Student Web App]
    Requester[Requester/Employer App]

    DataSharing[DataSharing Contract<br/>Main Orchestrator]
    ConsentMgr[ConsentManager<br/>Consent Logic]
    Identity[DigitalIdentity<br/>User & Credential Storage]
    Token[RewardToken ERC20]

    LocalStorage[Local File Storage<br/>Credential Files]

    Student --> DataSharing
    Requester --> DataSharing

    DataSharing --> ConsentMgr
    DataSharing --> Identity
    DataSharing --> Token

    ConsentMgr --> Identity

    Student -.-> LocalStorage
    Requester -.-> LocalStorage

    style DataSharing fill:#4CAF50
    style ConsentMgr fill:#2196F3
    style Identity fill:#2196F3
    style Token fill:#FF9800
```

---

## 2. Contract Dependency Graph

```mermaid
flowchart LR
    A[DigitalIdentity.sol<br/>No Dependencies]
    B[ConsentManager.sol<br/>Depends on DigitalIdentity]
    C[RewardToken.sol<br/>No Dependencies]
    D[DataSharing.sol<br/>Depends on All 3]

    A --> B
    A --> D
    B --> D
    C --> D

    style A fill:#90EE90
    style B fill:#87CEEB
    style C fill:#FFD700
    style D fill:#FF6B6B
```

**Deployment Order**:
1. Deploy `DigitalIdentity` first
2. Deploy `ConsentManager` (pass DigitalIdentity address)
3. Deploy `RewardToken` (independent)
4. Deploy `DataSharing` (pass all 3 addresses)
5. Grant `MINTER_ROLE` to DataSharing on RewardToken

---

## 3. Contract Interaction Flow

```mermaid
sequenceDiagram
    participant Student
    participant DataSharing
    participant ConsentMgr as ConsentManager
    participant Identity as DigitalIdentity
    participant Token as RewardToken

    Note over Student,Token: Student Grants Consent

    Student->>DataSharing: GrantConsentAndReward()
    DataSharing->>Identity: IsRegistered(student)?
    Identity-->>DataSharing: true
    DataSharing->>Identity: IsRegistered(employer)?
    Identity-->>DataSharing: true
    DataSharing->>Identity: GetCredentialHash()
    Identity-->>DataSharing: credHash
    DataSharing->>ConsentMgr: SetConsent()
    ConsentMgr-->>DataSharing: Consent stored
    DataSharing->>Token: mint(student, 10 tokens)
    Token-->>DataSharing: Tokens minted
    DataSharing-->>Student: Success + 10 tokens
```

---

## 4. Data Flow: On-Chain vs Off-Chain

```mermaid
flowchart TD
    A[Student has diploma.pdf] --> B[Store Locally]
    B --> C[Compute hash<br/>keccak256]
    C --> D[Submit hash to<br/>DigitalIdentity]

    D --> E[Hash stored on-chain]
    E --> F[Employer requests access]
    F --> G{Valid Consent?}

    G -->|Yes| H[Return hash]
    G -->|No| I[Access Denied]

    H --> J[Fetch file from local storage]
    J --> K{Verify hash?}

    K -->|Match| L[Credential Verified]
    K -->|No Match| M[File Tampered]

    style E fill:#4CAF50
    style H fill:#4CAF50
    style I fill:#f44336
    style L fill:#4CAF50
    style M fill:#f44336
```

---

## 5. Smart Contract Class Diagram

```mermaid
classDiagram
    class DigitalIdentity {
        +mapping users
        +mapping credentials
        +RegisterUser()
        +StoreCredential()
        +GetCredentialHash() bytes32
        +IsRegistered() bool
    }

    class ConsentManager {
        +mapping consents
        +address digitalIdentityContract
        +SetConsent()
        +RevokeConsent()
        +CheckConsent() bool
        +GetConsentExpiry() uint256
    }

    class DataSharing {
        +IDigitalIdentity identityContract
        +IConsentManager consentContract
        +IRewardToken tokenContract
        +GrantConsentAndReward()
        +RevokeConsentWrapper()
        +AccessData() bytes32
    }

    class RewardToken {
        +mapping balances
        +mint()
        +transfer()
        +balanceOf() uint256
    }

    DataSharing --> DigitalIdentity : reads
    DataSharing --> ConsentManager : calls
    DataSharing --> RewardToken : mints
    ConsentManager --> DigitalIdentity : validates
```

---

## 6. Consent State Machine

```mermaid
stateDiagram-v2
    [*] --> NoConsent
    NoConsent --> Active : GrantConsent()
    Active --> Active : GrantConsent() renew
    Active --> Revoked : RevokeConsent()
    Active --> Expired : Time passes
    Revoked --> Active : GrantConsent() new
    Expired --> Active : GrantConsent() new

    Active --> AccessGranted : AccessData() valid
    Revoked --> AccessDenied : AccessData()
    Expired --> AccessDenied : AccessData()
    NoConsent --> AccessDenied : AccessData()

    note right of Active
        Consent is valid
        Requester can access
    end note

    note right of Revoked
        Student revoked
        Access denied
    end note

    note right of Expired
        Time expired
        Access denied
    end note
```

---

## 7. Security Architecture Layers

```mermaid
flowchart TB
    A[Layer 1: Access Control]
    B[Layer 2: Validation]
    C[Layer 3: Execution Pattern]
    D[Layer 4: Data Privacy]
    E[Layer 5: Immutability]

    A --> A1[Only owner can grant consent]
    A --> A2[Only DataSharing mints tokens]

    B --> B1[Input validation]
    B --> B2[State validation]
    B --> B3[Cross-contract checks]

    C --> C1[Checks-Effects-Interactions]
    C --> C2[ReentrancyGuard]

    D --> D1[On-chain: Only hashes]
    D --> D2[Off-chain: Plaintext]

    E --> E1[Events: Permanent]
    E --> E2[Logs: Immutable]

    style A fill:#4CAF50
    style B fill:#2196F3
    style C fill:#FF9800
    style D fill:#9C27B0
    style E fill:#F44336
```

---

## 8. Gas Optimization Strategy

```mermaid
flowchart LR
    A[Gas Optimization]

    A --> B[Data Types]
    A --> C[Storage]
    A --> D[Execution]

    B --> B1[Use bytes32 not string]
    B --> B2[Use mapping not array]

    C --> C1[Emit events not storage]
    C --> C2[Delete for gas refund]
    C --> C3[Use immutable]

    D --> D1[Check expiry on-demand]
    D --> D2[Batch operations]
    D --> D3[Custom errors]

    style B1 fill:#90EE90
    style C1 fill:#87CEEB
    style D1 fill:#FFD700
```

---

## 9. Deployment Flow

```mermaid
flowchart TD
    Start([Start Deployment]) --> A[Deploy DigitalIdentity]
    A --> A1[Address: 0xAAAA]
    A1 --> B[Deploy ConsentManager]
    B --> B1[Address: 0xBBBB]
    B1 --> C[Deploy RewardToken]
    C --> C1[Address: 0xCCCC]
    C1 --> D[Deploy DataSharing]
    D --> D1[Address: 0xDDDD]
    D1 --> E[Grant MINTER_ROLE to DataSharing]
    E --> F([Deployment Complete])

    style A fill:#4CAF50
    style B fill:#4CAF50
    style C fill:#4CAF50
    style D fill:#4CAF50
    style E fill:#FF9800
    style F fill:#2196F3
```

---

## 10. Complete System Overview

```mermaid
flowchart TB
    subgraph Users
        S[Student]
        R[Requester]
    end

    subgraph Contracts
        DS[DataSharing]
        CM[ConsentManager]
        DI[DigitalIdentity]
        RT[RewardToken]
    end

    subgraph Storage
        LocalStorage[Local Files]
    end

    S --> DS
    R --> DS
    DS --> CM
    DS --> DI
    DS --> RT
    CM --> DI
    S -.-> LocalStorage
    R -.-> LocalStorage
```

---

## Summary

All diagrams use **Mermaid syntax** that should render in:
- GitHub
- VSCode (with Markdown Preview Mermaid Support extension)
- GitLab
- Many markdown viewers

If not rendering, install the **Markdown Preview Mermaid Support** extension in VSCode.