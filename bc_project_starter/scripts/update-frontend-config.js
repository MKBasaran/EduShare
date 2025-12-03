const fs = require('fs');
const path = require('path');

// Read deployment addresses
const deploymentPath = path.join(__dirname, '../deployment-addresses.json');
const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));

// Create new config content
const configContent = `// Contract addresses from deployment
export const CONTRACT_ADDRESSES = {
  DigitalIdentity: "${deployment.contracts.DigitalIdentity}",
  ConsentManager: "${deployment.contracts.ConsentManager}",
  RewardToken: "${deployment.contracts.RewardToken}",
  DataSharing: "${deployment.contracts.DataSharing}"
};

export const NETWORK_CONFIG = {
  chainId: 31337, // Hardhat default
  chainName: "Localhost",
  rpcUrl: "http://127.0.0.1:8545"
};

// Reward configuration
export const REWARD_PER_CONSENT = "10"; 
`;

// Write to config file
const configPath = path.join(__dirname, '../src/config.js');
fs.writeFileSync(configPath, configContent);

console.log('✓ Frontend config updated with new contract addresses');
