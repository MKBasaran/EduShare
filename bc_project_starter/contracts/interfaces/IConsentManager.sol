// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Interface for the ConsentManager contract. DataSharing uses this to manage
// all the consent records - granting, revoking, and checking them.
interface IConsentManager {
    // Grant consent to someone. DataSharing calls this when a student wants to
    // let an employer access their credentials.
    function SetConsent(
        address owner,
        address requester,
        bytes32 credentialTypeHash,
        uint256 expiryTimestamp
    ) external;

    // Revoke consent. Deletes the consent record completely.
    function RevokeConsent(address owner, address requester, bytes32 credentialTypeHash) external;

    // Check if consent is currently valid. Returns false if it doesn't exist,
    // is expired, or was revoked.
    function CheckConsent(
        address owner,
        address requester,
        bytes32 credentialTypeHash
    ) external view returns (bool);

    // Get when a consent expires
    function GetConsentExpiry(
        address owner,
        address requester,
        bytes32 credentialTypeHash
    ) external view returns (uint256);
}