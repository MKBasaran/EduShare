// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title RewardToken
 * @notice ERC20 token used to reward users for sharing credentials
 * @dev Implements role-based access control for minting
 */
contract RewardToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    event TokensRewarded(address indexed to, uint256 amount);

    /**
     * @notice Initialize the token with name "EduShareToken" and symbol "EDUSHARE"
     * @dev Grants DEFAULT_ADMIN_ROLE to deployer
     */
    constructor() ERC20("EduShareToken", "EDUSHARE") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @notice Mint new tokens to an address
     * @param to Address to receive tokens
     * @param amount Amount of tokens to mint (in wei, 18 decimals)
     * @dev Only callable by addresses with MINTER_ROLE (DataSharing contract)
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
        emit TokensRewarded(to, amount);
    }

    /**
     * @notice Check if contract supports an interface
     * @dev Required override for AccessControl
     */
    function supportsInterface(bytes4 interfaceId) public view override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
