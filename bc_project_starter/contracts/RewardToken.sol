// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

// This is the reward token that students earn when they share their data.
// It's a standard ERC20 token with role-based minting so only authorized contracts can create new tokens.
contract RewardToken is ERC20, AccessControl {
    // This role is required to mint new tokens. We'll give this to the DataSharing contract.
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // Fired whenever we mint reward tokens for someone
    event TokensRewarded(address indexed to, uint256 amount);

    // Sets up the token with name "EduShareToken" and symbol "EDUSHARE"
    // The deployer gets admin privileges to grant the minter role later
    constructor() ERC20("EduShareToken", "EDUSHARE") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // Mints new tokens as a reward. Only the DataSharing contract can call this
    // since it has the MINTER_ROLE. This is how students get rewarded for granting consent.
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
        emit TokensRewarded(to, amount);
    }

    // Required override for Solidity when using multiple inheritance with AccessControl
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
