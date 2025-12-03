# EduChain: Decentralized Academic Credential Sharing Platform

## Project Overview

**Domain**: Education - Academic Credential Verification

**Problem**: Students have no control over who accesses their academic credentials. Centralized verification systems are slow, opaque, and vulnerable to breaches. Students cannot revoke access once credentials are shared.

**Solution**: A blockchain-based platform where students own their credential hashes, grant time-limited consent to employers/universities, and earn tokens for sharing. All access is logged immutably on-chain.

---

## Actors (2 Roles Only)

### 1. Student (Identity Owner)
- Registers with hashed identity attributes
- Stores credential hashes (diploma, transcript)
- Grants/revokes consent to requesters
- Earns tokens when granting consent
- Views audit logs of access

### 2. Requester (Employer/University)
- Requests access to student credentials
- Can only access with valid, unexpired consent
- All access attempts are logged

---

## Key Features

✓ **Decentralized Identity**: Students register with hashed attributes (no plaintext PII on-chain)
✓ **Consent-Based Access**: Requesters need explicit, time-limited consent
✓ **Revocable Permissions**: Students revoke consent anytime
✓ **Immutable Audit Trail**: Every access logged permanently
✓ **Token Incentives**: Students earn tokens for granting consent
✓ **Off-Chain Storage**: Actual credentials stored off-chain, only hashes on-chain

---

## Smart Contract Architecture (3 Contracts)

1. **DigitalIdentity.sol**: User registration, credential hash storage
2. **ConsentManager.sol**: Consent creation, revocation, expiration
3. **DataSharing.sol**: Access verification, audit logging, token rewards

---

## Project Structure

```
bc_project_starter/
├── README.md                           # This file
├── docs/
│   ├── 01-functional-requirements.md   # Step 1 deliverable
│   ├── 02-system-design.md             # Step 2A deliverable (data models, tables)
│   ├── 03-smart-contract-design.md     # Step 2B deliverable (contract specs)
│   └── 04-implementation-guide.md      # Hardhat setup guide
└── diagrams/
    ├── architecture-diagram.md         # UML architecture
    ├── consent-workflow.md             # Consent grant/revoke flow
    └── access-workflow.md              # Data access flow
```

---

## Technology Stack

- **Smart Contracts**: Solidity ^0.8.20
- **Development**: Hardhat
- **Testing**: Hardhat + Solidity tests
- **Standards**: OpenZeppelin (Ownable, ERC20)
- **Deployment**: Local Hardhat network

---

## What's Included (Up to Step 3)

This starter package provides:

### Step 1: Research and Planning
- Problem statement (not really included yet it should be included in the report)
- 2 user roles (Student, Requester)
- Functional requirements
- High-level interactions

### Step 2A: Platform Design
- Data model with attribute table (on-chain vs off-chain)
- Consent model specification
- Audit log design

### Step 2B: Smart Contract Design
- 3 contract specifications
- Function signatures
- Security considerations
- **NO CODE** - just design

### Diagrams
- Architecture diagram (how contracts interact)
- Consent workflow
- Access workflow

---

## Next Steps (For Your Team)

1. **Review all docs** in `/docs` folder
2. **Discuss and refine** design with team
3. **Set up Hardhat** environment
4. **Implement contracts** based on specs in `03-smart-contract-design.md`
5. **Write tests** (one file per contract)
6. **Deploy and test** locally

---

## Important Notes

⚠️ **No Personal Data**: Use only hashed/fake data
⚠️ **Gas Optimization**: Monitor costs for key functions
⚠️ **Security First**: Follow checks-effects-interactions pattern
⚠️ **Local Testing**: Deploy to Hardhat network first

---

## Documentation Summary

| Document | Contents |
|----------|----------|
| `01-functional-requirements.md` | Roles, requirements, interaction flows |
| `02-system-design.md` | Data model table, consent model, audit log specs |
| `03-smart-contract-design.md` | 3 contract designs, function specs, security rules |
| `architecture-diagram.md` | UML showing contract relationships |
| `consent-workflow.md` | Grant/revoke consent flow |
| `access-workflow.md` | Data access verification flow |

---

**Ready to implement? Start with Step 3 using the contract designs provided.**