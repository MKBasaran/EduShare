// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IDigitalIdentity.sol";
import "./interfaces/IConsentManager.sol";
import "./interfaces/IRewardToken.sol";

// This is the main contract that brings everything together. When students want to grant
// consent to someone (like an employer), they go through this contract. It coordinates
// between DigitalIdentity, ConsentManager, and RewardToken to make sure everything works
// smoothly. Plus it rewards students with tokens when they share their data.
//
// Security stuff we're doing:
// - Checks-Effects-Interactions pattern to prevent reentrancy attacks
// - ReentrancyGuard just to be extra safe when minting tokens
// - All access attempts get logged so there's a permanent record
contract DataSharing is ReentrancyGuard {
    // References to the other three contracts we need to talk to
    IDigitalIdentity public immutable digitalIdentityContract;
    IConsentManager public immutable consentManagerContract;
    IRewardToken public immutable rewardTokenContract;

    // Every time someone grants consent, they get 10 tokens (with 18 decimals like most tokens)
    uint256 public constant REWARD_PER_CONSENT = 10 * 10**18;

    // Audit log structure for permanent on-chain storage
    struct AccessLog {
        address owner;              // Student who owns the credential
        address requester;          // Who tried to access
        bytes32 credentialTypeHash;
        bytes32 credentialHash;      // Hash returned (or 0x0 if denied)
        uint256 timestamp;
        bool granted;               // true = GRANTED, false = DENIED
        string reason;              // Reason if denied (empty if granted)
    }

    // On-chain storage for all access attempts
    AccessLog[] public accessLogs;
    uint256 public totalAccessLogs;

    // Indexed mappings for efficient querying
    mapping(address owner => uint256[]) public ownerLogIndices;      // Which logs belong to this owner
    mapping(address requester => uint256[]) public requesterLogIndices; // Which logs belong to this requester

    // Fired when we give someone tokens for granting consent
    event TokensRewarded(
        address indexed recipient,
        uint256 amount,
        uint256 timestamp
    );

    // Fired when someone successfully accesses a credential
    event AccessGranted(
        address indexed owner,
        address indexed requester,
        bytes32 indexed credentialTypeHash,
        bytes32 credentialHash,
        uint256 timestamp
    );

    // Fired when someone tries to access but gets denied (no consent or expired)
    event AccessDenied(
        address indexed owner,
        address indexed requester,
        bytes32 indexed credentialTypeHash,
        string reason,
        uint256 timestamp
    );

    // Errors
    error ConsentInvalid();
    error ConsentExpired();
    error ConsentNotFound();

    // Constructor - we need to know where all the other contracts are
    constructor(
        address _digitalIdentityContract,
        address _consentManagerContract,
        address _rewardTokenContract
    ) {
        require(_digitalIdentityContract != address(0), "Invalid DigitalIdentity address");
        require(_consentManagerContract != address(0), "Invalid ConsentManager address");
        require(_rewardTokenContract != address(0), "Invalid RewardToken address");

        digitalIdentityContract = IDigitalIdentity(_digitalIdentityContract);
        consentManagerContract = IConsentManager(_consentManagerContract);
        rewardTokenContract = IRewardToken(_rewardTokenContract);
    }

    // This is the main function students call to grant consent. It does two things:
    // 1. Grants the actual consent (with all the validations)
    // 2. Rewards the student with tokens
    //
    // We use the Checks-Effects-Interactions pattern here:
    // - CHECKS: ConsentManager validates everything (user registered, credential exists, etc.)
    // - EFFECTS: Consent gets stored and events are emitted
    // - INTERACTIONS: We mint tokens (last step to avoid reentrancy issues)
    function GrantConsentAndReward(
        address requester,
        bytes32 credentialTypeHash,
        uint256 expiryTimestamp
    ) external nonReentrant {
        // CHECKS & EFFECTS: Grant the consent
        // ConsentManager does all the validation - makes sure both users are registered,
        // credential exists, expiry is valid, duration is between 1-365 days, etc.
        consentManagerContract.SetConsent(
            msg.sender,  // owner (the student granting consent)
            requester,   // who they're granting it to
            credentialTypeHash,
            expiryTimestamp
        );

        // INTERACTIONS: Mint the reward tokens
        rewardTokenContract.mint(msg.sender, REWARD_PER_CONSENT);

        emit TokensRewarded(msg.sender, REWARD_PER_CONSENT, block.timestamp);
    }

    // Revoke consent you previously granted. You keep the tokens though.
    function RevokeConsentWrapper(
        address requester,
        bytes32 credentialTypeHash
    ) external {
        consentManagerContract.RevokeConsent(msg.sender, requester, credentialTypeHash);
    }

    // This is what requesters (employers) call to actually get the credential hash.
    // First we check if they have valid consent, then we retrieve the hash from
    // DigitalIdentity and return it. Everything gets logged both as events and on-chain.
    function AccessData(
        address owner,
        bytes32 credentialTypeHash
    ) external returns (bytes32) {
        // CHECKS: Make sure the requester has valid consent
        bool consentValid = consentManagerContract.CheckConsent(
            owner,
            msg.sender,
            credentialTypeHash
        );

        if (!consentValid) {
            // Store denied access attempt in on-chain log
            accessLogs.push(AccessLog({
                owner: owner,
                requester: msg.sender,
                credentialTypeHash: credentialTypeHash,
                credentialHash: bytes32(0),  // No hash returned for denied access
                timestamp: block.timestamp,
                granted: false,
                reason: "Consent invalid or expired"
            }));

            uint256 logIndex = accessLogs.length - 1;
            ownerLogIndices[owner].push(logIndex);
            requesterLogIndices[msg.sender].push(logIndex);
            totalAccessLogs++;

            // Emit event for off-chain indexing
            emit AccessDenied(
                owner,
                msg.sender,
                credentialTypeHash,
                "Consent invalid or expired",
                block.timestamp
            );
            revert ConsentInvalid();
        }

        // INTERACTIONS: Get the actual credential hash
        bytes32 credentialHash = digitalIdentityContract.GetCredentialHash(
            owner,
            credentialTypeHash
        );

        // Store successful access in on-chain log
        accessLogs.push(AccessLog({
            owner: owner,
            requester: msg.sender,
            credentialTypeHash: credentialTypeHash,
            credentialHash: credentialHash,
            timestamp: block.timestamp,
            granted: true,
            reason: ""
        }));

        uint256 logIndex = accessLogs.length - 1;
        ownerLogIndices[owner].push(logIndex);
        requesterLogIndices[msg.sender].push(logIndex);
        totalAccessLogs++;

        // Emit event for off-chain indexing
        emit AccessGranted(
            owner,
            msg.sender,
            credentialTypeHash,
            credentialHash,
            block.timestamp
        );

        return credentialHash;
    }

    // Check if someone can access a credential without actually accessing it.
    // This is a view function so it doesn't cost gas or change anything.
    function CanAccess(
        address owner,
        address requester,
        bytes32 credentialTypeHash
    ) external view returns (bool) {
        return consentManagerContract.CheckConsent(
            owner,
            requester,
            credentialTypeHash
        );
    }

    // Get when a consent expires
    function GetConsentExpiry(
        address owner,
        address requester,
        bytes32 credentialTypeHash
    ) external view returns (uint256) {
        return consentManagerContract.GetConsentExpiry(
            owner,
            requester,
            credentialTypeHash
        );
    }

    // Check if someone is registered
    function IsUserRegistered(address user) external view returns (bool) {
        return digitalIdentityContract.IsRegistered(user);
    }

    // Get someone's token balance
    function GetTokenBalance(address account) external view returns (uint256) {
        return rewardTokenContract.balanceOf(account);
    }

    // ============================================
    // Audit Log Query Functions
    // ============================================

    // Get all access logs for a specific owner (student)
    // Returns all access attempts to this student's credentials
    function getAccessLogsForOwner(address owner) 
        external 
        view 
        returns (AccessLog[] memory) 
    {
        uint256[] memory indices = ownerLogIndices[owner];
        AccessLog[] memory logs = new AccessLog[](indices.length);
        
        for (uint256 i = 0; i < indices.length; i++) {
            logs[i] = accessLogs[indices[i]];
        }
        
        return logs;
    }

    // Get all access logs for a specific requester (employer)
    // Returns all access attempts made by this requester
    function getAccessLogsForRequester(address requester) 
        external 
        view 
        returns (AccessLog[] memory) 
    {
        uint256[] memory indices = requesterLogIndices[requester];
        AccessLog[] memory logs = new AccessLog[](indices.length);
        
        for (uint256 i = 0; i < indices.length; i++) {
            logs[i] = accessLogs[indices[i]];
        }
        
        return logs;
    }

    // Get a specific log by index
    function getAccessLog(uint256 index) 
        external 
        view 
        returns (AccessLog memory) 
    {
        require(index < accessLogs.length, "Log does not exist");
        return accessLogs[index];
    }
}