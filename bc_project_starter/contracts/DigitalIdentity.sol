// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// This contract handles user registration and stores credential hashes on the blockchain.
// Important: We only store HASHES, never actual personal data. This keeps everything private
// while still allowing us to verify credentials later.
contract DigitalIdentity {
    struct User {
        bytes32 idHash;         // Hash of their unique ID (Slot 0)
        bytes32 emailHash;      // Hash of their email (Slot 1)
        bytes32 studentIdHash;  // Hash of their student or org ID (Slot 2)
        uint64 registeredAt;    // When they registered (Slot 3 - packed, saves gas)
        // Removed 'exists' - we check if idHash != 0 instead
    }
    struct Credential {
        bytes32 credentialHash; // Hash of the actual diploma/transcript file
        uint64 issuedAt;      

    }

    // Store all users by their wallet address
    mapping(address => User) private users;

    // Store credentials: user address => credential type => credential data
    mapping(address => mapping(bytes32 => Credential)) private credentials;

    // Fired when someone registers
    event IdentityRegistered(
        address indexed user,
        bytes32 idHash,
        uint256 timestamp
    );

    // Fired when someone stores a credential
    event CredentialStored(
        address indexed owner,
        bytes32 indexed credentialTypeHash,
        bytes32 credentialHash,
        uint256 timestamp
    );

    // Custom errors
    error AlreadyRegistered();
    error InvalidParameter();
    error UserNotRegistered();
    error CredentialNotFound();

    // Register a new user. You can only register once per address
    function RegisterUser(
        bytes32 idHash,
        bytes32 emailHash,
        bytes32 studentIdHash
    ) external {
        // Can't register twice (check if idHash is already set)
        if (users[msg.sender].idHash != bytes32(0)) {
            revert AlreadyRegistered();
        }

        // All parameters need to be non-zero hashes
        if (idHash == bytes32(0) || emailHash == bytes32(0) || studentIdHash == bytes32(0)) {
            revert InvalidParameter();
        }

        // Save the user info (optimized with uint64 for timestamp)
        users[msg.sender] = User({
            idHash: idHash,
            emailHash: emailHash,
            studentIdHash: studentIdHash,
            registeredAt: uint64(block.timestamp)
        });

        emit IdentityRegistered(msg.sender, idHash, block.timestamp);
    }

    // Store a credential hash. You can update existing credentials too
    function StoreCredential(
        bytes32 credentialTypeHash,
        bytes32 credentialHash
    ) external {
        // Need to be registered first (check if idHash is set)
        if (users[msg.sender].idHash == bytes32(0)) {
            revert UserNotRegistered();
        }

        // Both parameters need to be valid
        if (credentialTypeHash == bytes32(0) || credentialHash == bytes32(0)) {
            revert InvalidParameter();
        }

        // Store the credential hash (optimized with uint64 for timestamp)
        credentials[msg.sender][credentialTypeHash] = Credential({
            credentialHash: credentialHash,
            issuedAt: uint64(block.timestamp)
        });

        emit CredentialStored(
            msg.sender,
            credentialTypeHash,
            credentialHash,
            block.timestamp
        );
    }

    // Get the credential hash for someone. This is what other contracts call
    // when they want to retrieve a credential
    function GetCredentialHash(
        address owner,
        bytes32 credentialTypeHash
    ) external view returns (bytes32) {
        bytes32 credHash = credentials[owner][credentialTypeHash].credentialHash;
        
        if (credHash == bytes32(0)) {
            revert CredentialNotFound();
        }

        return credHash;
    }

    // Check if someone is registered (optimized - check if idHash is set)
    function IsRegistered(address user) external view returns (bool) {
        return users[user].idHash != bytes32(0);
    }

    // Get someone's ID hash
    function GetUserIdHash(address user) external view returns (bytes32) {
        bytes32 idHash = users[user].idHash;
        
        if (idHash == bytes32(0)) {
            revert UserNotRegistered();
        }

        return idHash;
    }

    // Get all info about a user
    function GetUserInfo(address user) external view returns (User memory) {
        User memory userInfo = users[user];
        
        if (userInfo.idHash == bytes32(0)) {
            revert UserNotRegistered();
        }

        return userInfo;
    }

    // Check if a specific credential exists for someone
    function CredentialExists(
        address owner,
        bytes32 credentialTypeHash
    ) external view returns (bool) {
        return credentials[owner][credentialTypeHash].credentialHash != bytes32(0);
    }

    // Get credential details including timestamp
    function GetCredentialInfo(
        address owner,
        bytes32 credentialTypeHash
    ) external view returns (Credential memory) {
        Credential memory cred = credentials[owner][credentialTypeHash];
        
        if (cred.credentialHash == bytes32(0)) {
            revert CredentialNotFound();
        }

        return cred;
    }
}
