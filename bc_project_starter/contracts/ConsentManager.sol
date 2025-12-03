// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IDigitalIdentity.sol";

// This contract manages consent records. Basically permission slips that let
// employers or other requesters access your credentials. All consent is time limited
// and can be revoked at any time.
contract ConsentManager {
    // Consent info for a specific permission
    struct Consent {
        bool exists;        // Does this consent record exist?
        uint256 expiry;     // When does it expire? (Unix timestamp)
        uint256 grantedAt;  // When was it granted?
        bool revoked;       // Was it revoked early? (we usually just delete instead)
    }

    // Triple nested mapping to store all consents:
    // owner => requester => credential type => consent details
    // For example: Alice => TechCorp => "Bachelor_Diploma" => consent record
    mapping(address => mapping(address => mapping(bytes32 => Consent))) private consents;

    // Need to check DigitalIdentity contract to make sure users and credentials exist
    IDigitalIdentity public immutable digitalIdentityContract;

    // Consent must be at least 1 day and at most 365 days
    uint256 public constant MIN_CONSENT_DURATION = 1 days;
    uint256 public constant MAX_CONSENT_DURATION = 365 days;

    // Fired when someone grants consent
    event ConsentGranted(
        address indexed owner,
        address indexed requester,
        bytes32 indexed credentialTypeHash,
        uint256 expiry,
        uint256 timestamp
    );

    // Fired when someone revokes consent
    event ConsentRevoked(
        address indexed owner,
        address indexed requester,
        bytes32 indexed credentialTypeHash,
        uint256 timestamp
    );

    // Errors
    error UserNotRegistered();
    error RequesterNotRegistered();
    error CredentialNotFound();
    error InvalidExpiryTimestamp();
    error CannotGrantToSelf();
    error ConsentNotFound();
    error InvalidConsentDuration();

    // Constructor 
    constructor(address _digitalIdentityContract) {
        require(_digitalIdentityContract != address(0), "Invalid address");
        digitalIdentityContract = IDigitalIdentity(_digitalIdentityContract);
    }

    // Grant consent to someone. This is called by DataSharing contract, not directly by users.
    // The owner parameter is the student granting consent, requester is who they're granting it to.
    function SetConsent(
        address owner,
        address requester,
        bytes32 credentialTypeHash,
        uint256 expiryTimestamp
    ) external {
        // Make sure the owner (student) is registered
        if (!digitalIdentityContract.IsRegistered(owner)) {
            revert UserNotRegistered();
        }

        // Make sure the requester (employer) is registered too
        if (!digitalIdentityContract.IsRegistered(requester)) {
            revert RequesterNotRegistered();
        }

        // Make sure the credential actually exists (this will revert if it doesn't)
        digitalIdentityContract.GetCredentialHash(owner, credentialTypeHash);

        // Expiry needs to be in the future
        if (expiryTimestamp <= block.timestamp) {
            revert InvalidExpiryTimestamp();
        }

        // Check that the duration is reasonable (between 1 day and 1 year)
        uint256 duration = expiryTimestamp - block.timestamp;
        if (duration < MIN_CONSENT_DURATION || duration > MAX_CONSENT_DURATION) {
            revert InvalidConsentDuration();
        }

        // Can't give yourself consent (that would be pointless)
        if (requester == owner) {
            revert CannotGrantToSelf();
        }

        // Store the consent record
        consents[owner][requester][credentialTypeHash] = Consent({
            exists: true,
            expiry: expiryTimestamp,
            grantedAt: block.timestamp,
            revoked: false
        });

        emit ConsentGranted(
            owner,
            requester,
            credentialTypeHash,
            expiryTimestamp,
            block.timestamp
        );
    }

    // Revoke a consent. Just deletes the consent record entirely.
    // Deleting gives us a gas refund which is nice.
    function RevokeConsent(
        address owner,
        address requester,
        bytes32 credentialTypeHash
    ) external {
        // Make sure the consent exists first
        if (!consents[owner][requester][credentialTypeHash].exists) {
            revert ConsentNotFound();
        }

        // Delete it completely
        delete consents[owner][requester][credentialTypeHash];

        emit ConsentRevoked(
            owner,
            requester,
            credentialTypeHash,
            block.timestamp
        );
    }

    // Check if a consent is valid right now. Returns false if it doesn't exist,
    // was revoked, or has expired.
    function CheckConsent(
        address owner,
        address requester,
        bytes32 credentialTypeHash
    ) external view returns (bool) {
        Consent memory consent = consents[owner][requester][credentialTypeHash];

        // Doesn't exist?
        if (!consent.exists) {
            return false;
        }

        // Was it revoked?
        if (consent.revoked) {
            return false;
        }

        // Has it expired?
        if (block.timestamp >= consent.expiry) {
            return false;
        }

        return true;
    }

    // Get when a consent expires
    function GetConsentExpiry(
        address owner,
        address requester,
        bytes32 credentialTypeHash
    ) external view returns (uint256) {
        if (!consents[owner][requester][credentialTypeHash].exists) {
            revert ConsentNotFound();
        }

        return consents[owner][requester][credentialTypeHash].expiry;
    }

    // Get all the details about a consent
    function GetConsentInfo(
        address owner,
        address requester,
        bytes32 credentialTypeHash
    ) external view returns (Consent memory) {
        if (!consents[owner][requester][credentialTypeHash].exists) {
            revert ConsentNotFound();
        }

        return consents[owner][requester][credentialTypeHash];
    }
}
