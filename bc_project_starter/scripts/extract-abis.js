const fs = require('fs');
const path = require('path');

// Contract names
const contracts = [
  'DigitalIdentity',
  'ConsentManager',
  'RewardToken',
  'DataSharing'
];

// Paths
const artifactsDir = path.join(__dirname, '../artifacts/contracts');
const outputDir = path.join(__dirname, '../src/utils');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Extract ABIs
contracts.forEach(contractName => {
  try {
    const artifactPath = path.join(artifactsDir, `${contractName}.sol`, `${contractName}.json`);
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

    const abiPath = path.join(outputDir, `${contractName}.abi.json`);
    fs.writeFileSync(abiPath, JSON.stringify(artifact.abi, null, 2));

    console.log(`Extracted ABI for ${contractName}`);
  } catch (error) {
    console.error(`Failed to extract ABI for ${contractName}:`, error.message);
  }
});

console.log('\nABI extraction complete!');
