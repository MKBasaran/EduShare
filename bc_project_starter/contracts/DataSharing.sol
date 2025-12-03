// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IDigitalIdentity.sol";
import "./interfaces/IConsentManager.sol";
import "./interfaces/IRewardToken.sol";

/**
 * @title DataSharing
 * @notice Main orchestrator contract for the EduChain platform
 * @dev Coordinates between DigitalIdentity, ConsentManager, and RewardToken
 * Uses Checks-Effects-Interactions pattern for security
 */
contract DataSharing {
    IDigitalIdentity public immutable digitalIdentityContract;
    IConsentManager public immutable consentManagerContract;
    IRewardToken public immutable rewardTokenContract;

    uint256 public constant REWARD_PER_CONSENT = 10 * 10**18;

    event TokensRewarded(address indexed recipient, uint256 amount, uint256 timestamp);
    event AccessGranted(address indexed owner, address indexed requester, bytes32 indexed credentialTypeHash, bytes32 credentialHash, uint256 timestamp);
    event AccessDenied(address indexed owner, address indexed requester, bytes32 indexed credentialTypeHash, string reason, uint256 timestamp);

    error InvalidAddress();
    error ConsentInvalid();
    error LengthMismatch();

    constructor(
        address _digitalIdentityContract,
        address _consentManagerContract,
        address _rewardTokenContract
    ) {
        if (_digitalIdentityContract == address(0)) revert InvalidAddress();
        if (_consentManagerContract == address(0)) revert InvalidAddress();
        if (_rewardTokenContract == address(0)) revert InvalidAddress();

        digitalIdentityContract = IDigitalIdentity(_digitalIdentityContract);
        consentManagerContract = IConsentManager(_consentManagerContract);
        rewardTokenContract = IRewardToken(_rewardTokenContract);
    }

    /**
     * @notice Grant consent to a requester and earn reward tokens
     * @param requester Address of the entity requesting access
     * @param credentialTypeHash Hash of the credential type (e.g., keccak256("Bachelor_Diploma"))
     * @param expiryTimestamp Unix timestamp when consent expires
     */
    function GrantConsentAndReward(
        address requester,
        bytes32 credentialTypeHash,
        uint256 expiryTimestamp
    ) external {
        // CHECKS & EFFECTS: ConsentManager validates and stores consent
        consentManagerContract.SetConsent(msg.sender, requester, credentialTypeHash, expiryTimestamp);
        
        // INTERACTIONS: Mint reward tokens to student
        rewardTokenContract.mint(msg.sender, REWARD_PER_CONSENT);
        emit TokensRewarded(msg.sender, REWARD_PER_CONSENT, block.timestamp);
    }

    /**
     * @notice Grant multiple consents in a single transaction (gas efficient)
     * @param requesters Array of requester addresses
     * @param credentialTypes Array of credential type hashes
     * @param expiries Array of expiry timestamps
     */
    function GrantMultipleConsents(
        address[] calldata requesters,
        bytes32[] calldata credentialTypes,
        uint256[] calldata expiries
    ) external {
        uint256 length = requesters.length;
        if (length != credentialTypes.length || length != expiries.length) revert LengthMismatch();

        // Grant all consents
        for (uint256 i = 0; i < length; i++) {
            consentManagerContract.SetConsent(msg.sender, requesters[i], credentialTypes[i], expiries[i]);
        }

        // Single token mint for all consents (more gas efficient)
        uint256 totalReward = REWARD_PER_CONSENT * length;
        rewardTokenContract.mint(msg.sender, totalReward);
        emit TokensRewarded(msg.sender, totalReward, block.timestamp);
    }

    /**
     * @notice Revoke previously granted consent
     * @param requester Address whose access should be revoked
     * @param credentialTypeHash Hash of the credential type
     */
    function RevokeConsentWrapper(address requester, bytes32 credentialTypeHash) external {
        consentManagerContract.RevokeConsent(msg.sender, requester, credentialTypeHash);
    }

    /**
     * @notice Access a credential hash (requires valid consent)
     * @param owner Address of the credential owner
     * @param credentialTypeHash Hash of the credential type to access
     * @return credentialHash The hash of the credential file
     * @dev All access attempts are logged via events for audit purposes
     */
    function AccessData(address owner, bytes32 credentialTypeHash) external returns (bytes32) {
        // CHECKS: Verify consent is valid
        bool consentValid = consentManagerContract.CheckConsent(owner, msg.sender, credentialTypeHash);

        if (!consentValid) {
            emit AccessDenied(owner, msg.sender, credentialTypeHash, "Consent invalid or expired", block.timestamp);
            revert ConsentInvalid();
        }

        // INTERACTIONS: Retrieve credential hash from DigitalIdentity
        bytes32 credentialHash = digitalIdentityContract.GetCredentialHash(owner, credentialTypeHash);
        emit AccessGranted(owner, msg.sender, credentialTypeHash, credentialHash, block.timestamp);
        
        return credentialHash;
    }

    /**
     * @notice Check if a requester can access a credential (view function)
     * @param owner Address of the credential owner
     * @param requester Address of the potential accessor
     * @param credentialTypeHash Hash of the credential type
     * @return bool True if access is allowed
     */
    function CanAccess(address owner, address requester, bytes32 credentialTypeHash) external view returns (bool) {
        return consentManagerContract.CheckConsent(owner, requester, credentialTypeHash);
    }

    /**
     * @notice Get the expiry timestamp for a consent
     */
    function GetConsentExpiry(address owner, address requester, bytes32 credentialTypeHash) external view returns (uint256) {
        return consentManagerContract.GetConsentExpiry(owner, requester, credentialTypeHash);
    }

    /**
     * @notice Check if a user is registered in the system
     */
    function IsUserRegistered(address user) external view returns (bool) {
        return digitalIdentityContract.IsRegistered(user);
    }

    /**
     * @notice Get the token balance of an account
     */
    function GetTokenBalance(address account) external view returns (uint256) {
        return rewardTokenContract.balanceOf(account);
    }
}
