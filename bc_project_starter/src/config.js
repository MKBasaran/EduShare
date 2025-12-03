// Contract addresses from deployment
export const CONTRACT_ADDRESSES = {
  DigitalIdentity: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
  ConsentManager: "0x0165878A594ca255338adfa4d48449f69242Eb8F",
  RewardToken: "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853",
  DataSharing: "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6"
};

// Network configuration for Hardhat local node
export const NETWORK_CONFIG = {
  chainId: 31337, // Hardhat default
  chainName: "Localhost",
  rpcUrl: "http://127.0.0.1:8545"
};

// Reward configuration
export const REWARD_PER_CONSENT = "10"; // 10 tokens per consent
