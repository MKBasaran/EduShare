import { ethers, formatUnits } from 'ethers';
import { CONTRACT_ADDRESSES } from '../config';
import DigitalIdentityABI from './DigitalIdentity.abi.json';
import ConsentManagerABI from './ConsentManager.abi.json';
import DataSharingABI from './DataSharing.abi.json';
import RewardTokenABI from './RewardToken.abi.json';

// Connect wallet
export const connectWallet = async () => {
  if (!window.ethereum) throw new Error("MetaMask not installed");

  // Switch to Hardhat network
  await window.ethereum.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: "0x7A69" }]
  }).catch(async (e) => {
    // If network is not added, add it
    if (e.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: "0x7A69",
          chainName: "Hardhat Local",
          rpcUrls: ["http://127.0.0.1:8545"]
        }]
      });
    }
  });

  // Request accounts
  await window.ethereum.request({ method: "eth_requestAccounts" });

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  return { provider, signer, address };
};

// Get contract instances
export const getContracts = (signer) => {
  return {
    digitalIdentity: new ethers.Contract(
      CONTRACT_ADDRESSES.DigitalIdentity,
      DigitalIdentityABI,
      signer
    ),
    consentManager: new ethers.Contract(
      CONTRACT_ADDRESSES.ConsentManager,
      ConsentManagerABI,
      signer
    ),
    dataSharing: new ethers.Contract(
      CONTRACT_ADDRESSES.DataSharing,
      DataSharingABI,
      signer
    ),
    rewardToken: new ethers.Contract(
      CONTRACT_ADDRESSES.RewardToken,
      RewardTokenABI,
      signer
    )
  };
};

// Helper function to hash strings (for privacy)
export const hashString = (str) => {
  return ethers.keccak256(ethers.toUtf8Bytes(str));
};

// Parse token amount
export const formatTokenAmount = (amount) => {
  return ethers.formatEther(amount);
};

// Format raw BigInt values
export const formatRaw = async (bigIntValue) => {
  return ethers.formatEther(bigIntValue);
};