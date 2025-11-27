// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// This contract handles user registration and stores credential hashes on the blockchain.
// Important: We only store HASHES, never actual personal data. This keeps everything private
// while still allowing us to verify credentials later.
contract DigitalIdentity {
    // User info - everything is hashed so no plaintext PII goes on-chain
    struct User {
        bytes32 idHash;         // Hash of their unique ID
        bytes32 emailHash;      // Hash of their email
        bytes32 studentIdHash;  // Hash of their student or org ID
        uint256 registeredAt;   // When they registered
        bool exists;            // Whether they're registered or not
    }

    // Credential info - again, only hashes
    struct Credential {
        bytes32 credentialHash; // Hash of the actual diploma/transcript file
        uint256 issuedAt;       // When it was stored
        bool exists;            // Whether it exists
    }

    // Store all users by their wallet address
    mapping(address => User) private users;

    // Store credentials: user address => credential type => credential data
    // For example: Alice's address => "Bachelor_Diploma" => diploma hash
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

    // Errors 
    error AlreadyRegistered();
    error InvalidParameter();
    error UserNotRegistered();
    error CredentialNotFound();

    // Register a new user. You can only register once per address.
    // All the parameters are hashes, not actual data, so privacy is maintained.
    function RegisterUser(
        bytes32 idHash,
        bytes32 emailHash,
        bytes32 studentIdHash
    ) external {
        // Can't register twice
        if (users[msg.sender].exists) {
            revert AlreadyRegistered();
        }

        // All parameters need to be non-zero hashes
        if (idHash == bytes32(0) || emailHash == bytes32(0) || studentIdHash == bytes32(0)) {
            revert InvalidParameter();
        }

        // Save the user info
        users[msg.sender] = User({
            idHash: idHash,
            emailHash: emailHash,
            studentIdHash: studentIdHash,
            registeredAt: block.timestamp,
            exists: true
        });

        emit IdentityRegistered(msg.sender, idHash, block.timestamp);
    }

    // Store a credential hash. You can update existing credentials too
    // (like if you get an updated transcript with new grades).
    function StoreCredential(
        bytes32 credentialTypeHash,
        bytes32 credentialHash
    ) external {
        // Need to be registered first
        if (!users[msg.sender].exists) {
            revert UserNotRegistered();
        }

        // Both parameters need to be valid
        if (credentialTypeHash == bytes32(0) || credentialHash == bytes32(0)) {
            revert InvalidParameter();
        }

        // Store the credential hash
        credentials[msg.sender][credentialTypeHash] = Credential({
            credentialHash: credentialHash,
            issuedAt: block.timestamp,
            exists: true
        });

        emit CredentialStored(
            msg.sender,
            credentialTypeHash,
            credentialHash,
            block.timestamp
        );
    }

    // Get the credential hash for someone. This is what other contracts call
    // when they want to retrieve a credential (after checking permissions).
    function GetCredentialHash(
        address owner,
        bytes32 credentialTypeHash
    ) external view returns (bytes32) {
        if (!credentials[owner][credentialTypeHash].exists) {
            revert CredentialNotFound();
        }

        return credentials[owner][credentialTypeHash].credentialHash;
    }

    // Check if someone is registered
    function IsRegistered(address user) external view returns (bool) {
        return users[user].exists;
    }

    // Get someone's ID hash
    function GetUserIdHash(address user) external view returns (bytes32) {
        if (!users[user].exists) {
            revert UserNotRegistered();
        }

        return users[user].idHash;
    }

    // Get all info about a user
    function GetUserInfo(address user) external view returns (User memory) {
        if (!users[user].exists) {
            revert UserNotRegistered();
        }

        return users[user];
    }

    // Check if a specific credential exists for someone
    function CredentialExists(
        address owner,
        bytes32 credentialTypeHash
    ) external view returns (bool) {
        return credentials[owner][credentialTypeHash].exists;
    }
}
