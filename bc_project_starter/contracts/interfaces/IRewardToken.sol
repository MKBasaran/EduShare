// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Interface for the RewardToken contract. DataSharing uses this to mint tokens
// when students grant consent, and to check balances.
interface IRewardToken {
    // Mint new tokens. Only addresses with MINTER_ROLE can call this (which is
    // just the DataSharing contract in our case).
    function mint(address to, uint256 amount) external;

    // Check how many tokens someone has
    function balanceOf(address account) external view returns (uint256);

    // Transfer tokens to someone. This is standard ERC20 stuff.
    function transfer(address to, uint256 amount) external returns (bool);
}
