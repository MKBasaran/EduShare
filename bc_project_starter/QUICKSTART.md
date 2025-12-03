# EduChain Quick Start Guide

Get your frontend up and running in 5 minutes!

## Step 1: Start Hardhat Node

Open a terminal and run:

```bash
npm run node
```

Keep this terminal running. You should see:
```
Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/
```

## Step 2: Deploy Contracts

Open a NEW terminal and run:

```bash
npm run deploy
```

You should see contract addresses printed. These are already saved in `deployment-addresses.json`.

## Step 3: Extract ABIs

Run this command to extract contract ABIs for the frontend:

```bash
npm run extract-abis
```

You should see:
```
✓ Extracted ABI for DigitalIdentity
✓ Extracted ABI for ConsentManager
✓ Extracted ABI for RewardToken
✓ Extracted ABI for DataSharing
```

## Step 4: Start Frontend

Run:

```bash
npm run dev
```

The app will open at `http://localhost:3000`

## Step 5: Configure MetaMask

### Add Hardhat Network

1. Open MetaMask
2. Click network dropdown (top)
3. Click "Add Network" or "Add network manually"
4. Enter these details:
   - **Network Name:** `Localhost 8545`
   - **RPC URL:** `http://127.0.0.1:8545`
   - **Chain ID:** `31337`
   - **Currency Symbol:** `ETH`
5. Click "Save"

### Import Test Account

1. Click account icon (top right)
2. Select "Import Account"
3. Paste the private keys you get when starting the HardHat Node:
4. Click "Import"

This account has 10,000 test ETH.


## Step 6: Connect Wallet

1. Go to `http://localhost:3000`
2. Click "Connect Wallet"
3. Select MetaMask
4. Approve the connection

## Step 7: Test the App



## Architecture Overview

```
┌─────────────┐
│  Frontend   │ (React )
│             │
└──────┬──────┘
       │
       │ ethers.js
       │
┌──────▼──────────────────┐
│      MetaMask           │
│  (Web3 Provider)        │
└──────┬──────────────────┘
       │
       │ JSON-RPC
       │
┌──────▼──────────────────┐
│   Hardhat Node          │
│  (Local Blockchain)     │
└──────┬──────────────────┘
       │
┌──────▼──────────────────┐
│   Smart Contracts       │
│ ─ DigitalIdentity       │
│ ─ ConsentManager        │
│ ─ RewardToken           │
│ ─ DataSharing           │
└─────────────────────────┘
```

