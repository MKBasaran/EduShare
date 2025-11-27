// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Interface for the DigitalIdentity contract. Other contracts use this to talk
// to DigitalIdentity without needing to know all the implementation details.
interface IDigitalIdentity {
    // Check if a user is registered
    function IsRegistered(address user) external view returns (bool);

    // Get the credential hash for someone. This is what employers retrieve
    // after they've been granted consent.
    function GetCredentialHash(address owner, bytes32 credentialTypeHash)
        external
        view
        returns (bytes32);

    // Get someone's ID hash (not really used much but it's here if needed)
    function GetUserIdHash(address user) external view returns (bytes32);
}
