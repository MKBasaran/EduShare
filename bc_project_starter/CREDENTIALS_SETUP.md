# EduChain Credential Storage System

## Overview

The EduChain platform uses a **dual-storage system** for academic credentials:

1. **On-Chain (Blockchain)**: Only cryptographic hashes are stored for privacy and verification
2. **Off-Chain (Local Files)**: Full credential details are stored as JSON files in the `student_data/` folder

## How It Works

### Storing Credentials

When you store a credential through the website:

1. **On-Chain Storage**: The credential data is hashed and stored on the blockchain via the `StoreCredential()` function in [DigitalIdentity.sol](contracts/DigitalIdentity.sol)
2. **Off-Chain Storage**: The full credential details are saved as a JSON file in the `student_data/` folder via the backend API

**File Naming Pattern**: `{credentialType}_{walletAddressSuffix}_{timestamp}.json`

Example: `diploma_70997970_1701234567890.json`

### Granting Consent

When granting consent to share credentials:

1. Select a credential from the dropdown (populated from your stored credentials)
2. Select a recipient (from registered users)
3. Set duration (1-365 days)
4. Submit to grant consent and earn 10 EDUSHARE tokens

The system will:
- Hash the credential type
- Calculate expiry timestamp
- Call `GrantConsentAndReward()` with the correct parameters
- Store the consent on-chain

## Running the System

### 1. Start the Hardhat Node (1st terminal)

```bash
npm run node
```

### 2. Deploy Contracts 

```bash
npm run deploy
npm run setup-frontend
```

### 3. Start the Backend Server (3rd terminal)

```bash
npm run backend
```

This starts the Express server on **port 3001** which handles:
- Saving credentials as JSON files
- Retrieving credentials for display
- Serving the `student_data/` folder

### 4. Start the Frontend (2nd terminal)

```bash
npm start
```

This starts the webpack dev server on **port 3000**

## API Endpoints

### POST `/api/save-credential`

Saves a credential as a JSON file.

**Request Body**:
```json
{
  "walletAddress": "0x...",
  "credentialType": "diploma",
  "degree": "Bachelor of Science in Computer Science",
  "institution": "Maastricht University",
  "gpa": "3.8",
  "graduationYear": "2024",
  "studentName": "John Doe"
}
```

**Response**:
```json
{
  "success": true,
  "filename": "diploma_70997970_1701234567890.json",
  "message": "Credential saved successfully"
}
```

### GET `/api/credentials/:walletAddress`

Retrieves all credentials for a specific wallet address.

**Response**:
```json
{
  "credentials": [
    {
      "filename": "diploma_70997970_1701234567890.json",
      "credentialType": "Diploma",
      "studentInfo": {
        "name": "John Doe",
        "walletAddress": "0x..."
      },
      "degree": {
        "type": "Bachelor of Science",
        "major": "Computer Science",
        "university": "Maastricht University",
        "gpa": "3.8"
      },
      "issuer": {
        "name": "Maastricht University Registrar",
        "issuedDate": "2024-12-03T01:00:00.000Z"
      },
      "graduationYear": "2024"
    }
  ]
}
```

### GET `/api/credentials`

Lists all credentials (all users).

## File Structure

```
student_data/
├── diploma_70997970_1701234567890.json
├── diploma_f39Fd6e5_1701234567891.json
└── certificate_12345678_1701234567892.json
```

## Security & Privacy

- **On-Chain**: Only hashes are stored, no personal information
- **Off-Chain**: Full details stored locally, never on blockchain
- **Verification**: Recipients can verify file authenticity by comparing hashes
- **Consent**: Time-limited access control via smart contracts
- **Rewards**: 10 EDUSHARE tokens earned per consent granted

