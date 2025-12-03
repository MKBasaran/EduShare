# Step 1: Research and Planning

## 1. Problem Statement

### Current Issues with Educational Credential Verification

**Centralized Control**: Universities and third-party services control student credential data. Students cannot see who accesses their transcripts or revoke access once shared.

**Slow Verification**: Employers wait weeks for credential verification through centralized clearinghouses.

**Privacy Concerns**: Students must share entire transcripts even when only degree verification is needed.

**No Audit Trail**: No record of who accessed credentials and when.

**Data Breaches**: Centralized databases are targets for hackers. A single breach exposes all users.

**Fraud**: Paper diplomas and PDF certificates are easily forged. No cryptographic verification exists.

### What Doesn't Work

- Email-based credential sharing (no revocation possible)
- PDF diplomas sent via email (can be edited)
- Third-party verification services (expensive, slow, centralized)
- Manual phone/fax verification (outdated, time-consuming)

### What Works (Our Solution)

- Student ownership of credential hashes
- Blockchain-based immutable audit logs
- Time-limited, revocable consent
- Cryptographic verification
- Token incentives for data sharing

---

## 2. User Roles

### Role 1: Student (Identity Owner)

**Description**: The individual who owns educational credentials and controls access to them.

**Responsibilities**:
- Register on platform with hashed identity attributes
- Store hashes of credentials (diploma, transcript, certificates)
- Grant time-limited consent to requesters
- Revoke consent when needed
- Monitor who accessed their credentials (view audit logs)
- Earn reward tokens for granting consent

**Key Attributes**:
- Student ID hash
- Name hash
- Email hash
- University/institution name
- Degree type (Bachelor's, Master's, PhD)
- Graduation year
- Credential hashes (diploma hash, transcript hash)

**Permissions**:
- Full control over own credentials
- Grant/revoke consent to any requester
- View own audit logs
- Withdraw/transfer earned tokens

---

### Role 2: Requester (Employer/University)

**Description**: Entities that need to verify student credentials (e.g., employers verifying a job applicant's degree, universities verifying transfer credits).

**Examples**:
- Companies hiring graduates
- Universities accepting transfer students
- Professional licensing boards
- Scholarship providers

**Responsibilities**:
- Request access to specific student credentials
- Access credentials only with valid, unexpired consent
- Respect consent duration and data type restrictions

**Key Attributes**:
- Requester ID
- Organization name
- Organization type (employer, university, etc.)
- Contact info hash

**Permissions**:
- Request consent from students (off-chain communication)
- Access granted credentials during consent period
- View access logs for their own requests

---

## 3. Action Mapping

| Action | Student | Requester |
|--------|---------|-----------|
| Register on platform | Yes | Yes |
| Store credential hash | Yes | No |
| Request credential access | No | Yes (off-chain) |
| Grant consent | Yes | No |
| Revoke consent | Yes | No |
| Access credential data | Yes (own) | Yes (with consent) |
| View audit logs | Yes (own) | Yes (own requests) |
| Earn tokens | Yes | No |

---

## 4. Functional Requirements

### FR-1: User Registration

**Description**: All users must register with hashed identity attributes before using the platform.

**Actor**: Student or Requester

**Inputs**:
- `idHash` (bytes32): Keccak256 hash of unique ID
- `emailHash` (bytes32): Keccak256 hash of email
- `studentIdHash` (bytes32): Keccak256 hash of student/organization ID

**Process**:
1. User submits registration transaction
2. Contract validates no duplicate registration
3. Contract stores hashed attributes
4. Contract emits `IdentityRegistered` event

**Outputs**:
- User address added to registry
- `IdentityRegistered(address user, bytes32 idHash)` event emitted

**Acceptance Criteria**:
- No plaintext PII stored on-chain
- Each address can only register once
- All required fields provided
- Event emitted for tracking

---

### FR-2: Credential Storage

**Description**: Students store hashes of their academic credentials (diploma, transcript).

**Actor**: Student

**Inputs**:
- `credentialTypeHash` (bytes32): Hash of credential type (e.g., "Bachelor_Diploma", "Transcript")
- `credentialHash` (bytes32): Hash of actual credential file (stored off-chain)

**Process**:
1. Student computes hash of off-chain credential file
2. Student submits hash + type to smart contract
3. Contract stores mapping: studentAddress → credentialType → hash
4. Contract emits `CredentialStored` event

**Outputs**:
- Credential hash stored on-chain
- `CredentialStored(address student, bytes32 credentialTypeHash, bytes32 credentialHash)` event emitted

**Acceptance Criteria**:
- Only registered students can store credentials
- Actual credential file stored off-chain (JSON, PDF, etc.)
- Hash is verifiable later
- Students can update credential hashes (e.g., new transcript)

---

### FR-3: Consent Grant

**Description**: Students grant time-limited consent for requesters to access specific credentials.

**Actor**: Student

**Inputs**:
- `requesterAddress` (address): Address of requester
- `credentialTypeHash` (bytes32): Which credential to grant access to
- `expiryTimestamp` (uint256): Unix timestamp when consent expires

**Process**:
1. Student calls `SetConsent(requester, credentialType, expiry)`
2. Contract validates:
   - Requester is registered
   - Credential exists
   - Expiry is in future (between 1-365 days from now)
3. Contract creates consent record
4. Contract mints reward tokens to student (e.g., 10 tokens)
5. Contract emits `ConsentGranted` event

**Outputs**:
- Consent stored: `consents[student][requester][credentialType] = Consent struct`
- Tokens minted to student
- `ConsentGranted(student, requester, credentialType, expiry)` event emitted

**Acceptance Criteria**:
- Consent duration: 1-365 days
- Student receives tokens immediately
- Cannot grant consent to unregistered requester
- Cannot grant consent to non-existent credential
- Previous consent can be overwritten (updated expiry)

---

### FR-4: Consent Revocation

**Description**: Students revoke previously granted consent, immediately invalidating access.

**Actor**: Student

**Inputs**:
- `requesterAddress` (address): Address of requester
- `credentialTypeHash` (bytes32): Which credential to revoke access to

**Process**:
1. Student calls `RevokeConsent(requester, credentialType)`
2. Contract validates consent exists
3. Contract deletes consent record (or marks as revoked)
4. Contract emits `ConsentRevoked` event
5. Tokens are NOT reclaimed

**Outputs**:
- Consent deleted/revoked
- `ConsentRevoked(student, requester, credentialType, timestamp)` event emitted

**Acceptance Criteria**:
- Only the student who granted consent can revoke
- Revocation is immediate (next block)
- Future access attempts will fail
- Tokens remain with student
- Previous access logs remain immutable

---

### FR-5: Data Access

**Description**: Requesters access credential hashes if they have valid, unexpired consent.

**Actor**: Requester

**Inputs**:
- `ownerAddress` (address): Student whose credential to access
- `credentialTypeHash` (bytes32): Which credential to access

**Process**:
1. Requester calls `AccessData(owner, credentialType)`
2. Contract checks consent:
   - Consent exists
   - `block.timestamp < consent.expiry`
   - Consent not revoked
3. If valid:
   - Return credential hash
   - Emit `AccessGranted` event with all details
4. If invalid:
   - Emit `AccessDenied` event with reason
   - Revert with error

**Outputs**:
- Credential hash returned (if access granted)
- `AccessGranted` or `AccessDenied` event emitted with all relevant data

**Acceptance Criteria**:
- No consent = access denied
- Expired consent = access denied
- Revoked consent = access denied
- Valid consent = access granted
- All attempts logged (success and failure)
- No tokens transferred during access

---

### FR-6: Audit Logging

**Description**: Every credential access attempt is logged immutably on-chain via events.

**Actor**: System (automatic)

**Data Logged**:
- Owner address (student)
- Requester address
- Credential type hash
- Credential hash (if granted)
- Timestamp (block.timestamp)
- Status: GRANTED or DENIED (via event type)
- Reason (if denied)

**Process**:
- Logs are automatically created during `AccessData()`
- Logs are emitted as events (stored in transaction logs)
- Events are indexed for efficient filtering
- No storage arrays needed (gas-efficient)

**Outputs**:
- `AccessGranted` or `AccessDenied` event emitted
- Events permanently stored in blockchain transaction logs

**Acceptance Criteria**:
- Every access attempt logged via events
- Logs are immutable (part of transaction receipts)
- Students can query logs for their credentials (off-chain via RPC)
- Requesters can query logs for their access attempts (off-chain via RPC)
- Logs include both success and failure
- Events use indexed parameters for efficient filtering

---

### FR-7: Token Rewards

**Description**: Students earn ERC20-like tokens when granting consent.

**Actor**: System (automatic)

**Process**:
1. When student calls `SetConsent()`, tokens are minted
2. Token amount is fixed (e.g., 10 tokens per consent grant)
3. Tokens are transferable
4. Tokens do NOT grant data access (only consent does)

**Outputs**:
- Tokens minted to student address
- `TokensRewarded(student, amount)` event emitted

**Acceptance Criteria**:
- Tokens minted only when consent granted (not on access)
- Token amount configurable by contract owner
- Tokens are standard ERC20
- Students can transfer/withdraw tokens
- Data ownership never transfers (tokens only incentivize sharing)

---

### FR-8: Consent Expiration (Automatic)

**Description**: Consent automatically expires after specified timestamp.

**Actor**: System (automatic)

**Process**:
- When `AccessData()` is called, contract checks `block.timestamp < consent.expiry`
- If current time > expiry, access is denied
- No manual action needed

**Acceptance Criteria**:
- Expired consent cannot be used
- No gas cost for expiration (checked on-demand)
- Students can grant new consent after expiration

---

## 5. High-Level System Interactions

### Interaction 1: Student Registration

```
1. Student visits platform
2. Student provides: name, email, student ID (off-chain)
3. Platform computes hashes: Keccak256(name), Keccak256(email), Keccak256(studentID)
4. Platform calls DigitalIdentity.RegisterUser(idHash, emailHash, studentIdHash)
5. Smart contract stores hashes
6. Event emitted: IdentityRegistered(studentAddress, idHash)
7. Student is now registered
```

---

### Interaction 2: Student Stores Credential

```
1. Student has diploma PDF file
2. Student stores diploma in local off-chain storage (local JSON file)
3. Platform computes hash: Keccak256(diploma_file_content)
4. Platform computes credential type hash: Keccak256("Bachelor_Diploma")
5. Platform calls DigitalIdentity.StoreCredential(credentialTypeHash, credentialHash)
6. Smart contract stores: credentials[studentAddress][credentialTypeHash] = credentialHash
7. Event emitted: CredentialStored(studentAddress, credentialTypeHash, credentialHash)
8. Credential is now on-chain (as hash)
```

---

### Interaction 3: Requester Requests Access (Off-Chain)

```
1. Employer contacts student (email, platform message, etc.)
2. Employer says: "Please grant me access to your Bachelor's degree for 30 days"
3. Student reviews request
4. Student proceeds to grant consent (Interaction 4)
```

---

### Interaction 4: Student Grants Consent

```
1. Student calls ConsentManager.SetConsent(employerAddress, credentialTypeHash, expiryTimestamp)
2. Contract validates:
   - Employer is registered ✓
   - Credential exists ✓
   - Expiry is future date (current + 30 days) ✓
3. Contract creates consent:
   consents[studentAddress][employerAddress][credentialTypeHash] = Consent({
     exists: true,
     expiry: block.timestamp + 30 days,
     credentialType: credentialTypeHash,
     requester: employerAddress
   })
4. Contract mints 10 tokens to student
5. Event emitted: ConsentGranted(student, employer, credentialType, expiry)
6. Employer is notified (off-chain)
```

---

### Interaction 5: Requester Accesses Credential

```
1. Employer calls DataSharing.AccessData(studentAddress, credentialTypeHash)
2. Contract checks consent:
   - Consent exists? YES
   - block.timestamp < consent.expiry? YES (still within 30 days)
   - Consent revoked? NO
3. Access GRANTED:
   - Contract retrieves credentialHash from DigitalIdentity contract
   - Contract emits: AccessGranted(student, employer, credentialType, credentialHash, timestamp)
   - Contract returns credentialHash to employer
4. Employer uses hash to fetch off-chain diploma file
5. Employer verifies hash matches file content
```

---

### Interaction 6: Student Revokes Consent

```
1. Student calls ConsentManager.RevokeConsent(employerAddress, credentialTypeHash)
2. Contract deletes consent record
3. Event emitted: ConsentRevoked(student, employer, credentialType, timestamp)
4. Future access attempts by employer will fail
5. Tokens remain with student (not reclaimed)
```

---

### Interaction 7: Failed Access Attempt

```
1. Employer calls DataSharing.AccessData(studentAddress, credentialTypeHash)
2. Contract checks consent:
   - Consent exists? YES
   - block.timestamp < consent.expiry? NO (expired)
3. Access DENIED:
   - Contract emits: AccessDenied(student, employer, credentialType, "expired", timestamp)
   - Contract reverts with error: "ConsentExpired()"
4. Employer cannot access credential
```

---

### Interaction 8: Student Views Audit Logs

```
1. Student queries AccessGranted and AccessDenied events filtered by their address (off-chain via RPC)
2. Results show:
   - Employer A accessed Bachelor_Diploma on 2024-01-15 (AccessGranted event)
   - Employer B tried to access Transcript on 2024-01-20 (AccessDenied event - no consent)
   - University C accessed Transcript on 2024-01-22 (AccessGranted event)
3. Student has full transparency through event logs
```

---

## 6. Summary

### Defined User Roles: 2
1. **Student**: Owns credentials, grants/revokes consent, earns tokens
2. **Requester**: Requests access, accesses with valid consent

### Functional Requirements: 8
1. User Registration (hashed attributes)
2. Credential Storage (hash on-chain, file off-chain)
3. Consent Grant (time-limited, token reward)
4. Consent Revocation (immediate, tokens not reclaimed)
5. Data Access (consent validation, logging)
6. Audit Logging (immutable, all attempts)
7. Token Rewards (ERC20, minted on consent grant)
8. Consent Expiration (automatic, timestamp-based)

### High-Level Interactions: 8
- Registration → Credential Storage → Consent Grant → Access → Revocation → Audit

---

## Deliverable Checklist (Step 1)

**Problem Statement**: Defined (Section 1)
**User Roles**: 2 roles defined (Section 2)
**Functional Requirements**: 8 requirements specified (Section 4)
**High-Level Interactions**: 8 interaction flows (Section 5)

**Next**: Proceed to Step 2 - System Design (data models, consent model, audit log design)