import React, { useState, useEffect } from 'react';
import { connectWallet, getContracts, formatTokenAmount, hashString } from './utils/contracts';
import './styles.css';

function App() {
  const [wallet, setWallet] = useState(null);
  const [provider, setProvider] = useState(null);
  const [blockNumber, setBlockNumber] = useState(null);
  const [contracts, setContracts] = useState(null);
  const [tokenBalance, setTokenBalance] = useState('0');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [activeTab, setActiveTab] = useState('identity');

  // Form states
  const [identityForm, setIdentityForm] = useState({ name: '', email: '', institution: '' });
  const [credentialForm, setCredentialForm] = useState({
    credentialType: '',
    degree: '',
    institution: '',
    gpa: '',
    graduationYear: ''
  });
  const [consentForm, setConsentForm] = useState({ recipientAddress: '', duration: '30', credentialType: '' });
  const [accessForm, setAccessForm] = useState({ ownerAddress: '', credentialHash: '' });
  const [revokeForm, setRevokeForm] = useState({ recipientAddress: '', credentialTypeHash: '' });

  // Existing identity info
  const [existingIdentity, setExistingIdentity] = useState(null);
  const [isRegistered, setIsRegistered] = useState(false);

  // All users list
  const [allUsers, setAllUsers] = useState([]);

  // Stored credentials from student_data folder
  const [storedCredentials, setStoredCredentials] = useState([]);

  // Granted consents (consents I've given to others)
  const [myGrantedConsents, setMyGrantedConsents] = useState([]);

  // Received consents (consents others have given to me)
  const [myReceivedConsents, setMyReceivedConsents] = useState([]);

  // Viewed credential JSON
  const [viewedCredential, setViewedCredential] = useState(null);

  const handleConnect = async () => {
    try {
      setLoading(true);
      const { provider, signer, address } = await connectWallet();
      const blockNumber = await provider.getBlockNumber(); // Ensure connection is established
      blockNumber && setBlockNumber(blockNumber);

      setProvider(provider);
      setWallet({ address });

      const contractInstances = getContracts(signer);
      setContracts(contractInstances);

      // Load token balance
      try {
        const balance = await contractInstances.rewardToken.balanceOf(address);
        setTokenBalance(formatTokenAmount(balance));
      } catch (balanceErr) {
        console.error('Error loading balance:', balanceErr);
        setTokenBalance('0');
      }

      setMessage({ type: 'success', text: 'Wallet connected successfully!' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }

    
  };

  const verify = async () => {
    console.log("Verifying all addresses...");
    console.log("wallet : ", JSON.stringify(wallet, null, 2));
    console.log("wallet address : " + wallet.address);
    console.log("rewardToken Address : ", contracts.rewardToken.target);
    const bigIntValue  = await contracts.rewardToken.balanceOf(wallet.address);
    console.log(formatTokenAmount(bigIntValue));
    console.log("current block number : " + blockNumber);
  }

  const loadExistingIdentity = async () => {
    if (!contracts || !wallet) return;

    try {
      // Check if user is registered
      const registered = await contracts.digitalIdentity.IsRegistered(wallet.address);
      setIsRegistered(registered);

      if (registered) {
        // Get user info
        const userInfo = await contracts.digitalIdentity.GetUserInfo(wallet.address);
        setExistingIdentity({
          idHash: userInfo.idHash,
          emailHash: userInfo.emailHash,
          studentIdHash: userInfo.studentIdHash,
          registeredAt: new Date(Number(userInfo.registeredAt) * 1000).toLocaleString()
        });
      }
    } catch (err) {
      console.error('Error loading identity:', err);
    }
  };

  const loadAllUsers = async () => {
    if (!contracts || !provider) return;

    try {
      // Query IdentityRegistered events to get all registered users
      const filter = contracts.digitalIdentity.filters.IdentityRegistered();
      const events = await contracts.digitalIdentity.queryFilter(filter, 0, 'latest');

      const users = await Promise.all(events.map(async (event) => {
        const userAddress = event.args.user;
        try {
          const userInfo = await contracts.digitalIdentity.GetUserInfo(userAddress);
          return {
            address: userAddress,
            idHash: userInfo.idHash,
            emailHash: userInfo.emailHash,
            studentIdHash: userInfo.studentIdHash,
            registeredAt: new Date(Number(userInfo.registeredAt) * 1000).toLocaleString()
          };
        } catch {
          return null;
        }
      }));

      setAllUsers(users.filter(u => u !== null));
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  const loadStoredCredentials = async () => {
    if (!wallet) return;

    try {
      // Fetch credentials for the current wallet from backend API
      const response = await fetch(`http://localhost:3001/api/credentials/${wallet.address}`);
      if (response.ok) {
        const data = await response.json();
        setStoredCredentials(data.credentials || []);
      } else {
        setStoredCredentials([]);
      }
    } catch (err) {
      console.error('Error loading credentials from backend:', err);
      setStoredCredentials([]);
    }
  };

  const loadConsents = async () => {
    if (!contracts || !wallet || !provider) return;

    try {
      // Load consents I've granted from ConsentManager
      const grantedFilter = contracts.consentManager.filters.ConsentGranted(wallet.address);
      const grantedEvents = await contracts.consentManager.queryFilter(grantedFilter, 0, 'latest');

      const granted = grantedEvents.map(event => ({
        recipient: event.args.requester,
        credentialTypeHash: event.args.credentialTypeHash,
        expiryTimestamp: Number(event.args.expiry),
        expiryDate: new Date(Number(event.args.expiry) * 1000).toLocaleString(),
        grantedAt: new Date(Number(event.args.timestamp) * 1000).toLocaleString()
      }));

      setMyGrantedConsents(granted);

      // Load consents granted to me
      const receivedFilter = contracts.consentManager.filters.ConsentGranted(null, wallet.address);
      const receivedEvents = await contracts.consentManager.queryFilter(receivedFilter, 0, 'latest');

      const received = receivedEvents.map(event => ({
        owner: event.args.owner,
        credentialTypeHash: event.args.credentialTypeHash,
        expiryTimestamp: Number(event.args.expiry),
        expiryDate: new Date(Number(event.args.expiry) * 1000).toLocaleString(),
        grantedAt: new Date(Number(event.args.timestamp) * 1000).toLocaleString()
      }));

      setMyReceivedConsents(received);
    } catch (err) {
      console.error('Error loading consents:', err);
    }
  };

  useEffect(() => {
    if (!wallet) return;

    verify();
    loadExistingIdentity();
    loadAllUsers();
    loadStoredCredentials();
    loadConsents();
  }, [wallet, blockNumber]);


  const refreshBalance = async () => {
    if (contracts && wallet) {
      const balance = await contracts.rewardToken.balanceOf(wallet.address);
      setTokenBalance(formatTokenAmount(balance));
    }
  };

  // Register Digital Identity
  const handleRegisterIdentity = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const hashedName = hashString(identityForm.name);
      const hashedEmail = hashString(identityForm.email);
      const hashedInstitution = hashString(identityForm.institution);

      const tx = await contracts.digitalIdentity.RegisterUser(hashedName, hashedEmail, hashedInstitution);
      await tx.wait();

      setMessage({ type: 'success', text: 'Identity registered successfully!' });
      setIdentityForm({ name: '', email: '', institution: '' });

      // Reload the identity info
      await loadExistingIdentity();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Store Credential (dual storage: on-chain hash + off-chain JSON)
  const handleStoreCredential = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const hashedType = hashString(credentialForm.credentialType);

      // Combine all credential fields into a single data string
      const credentialData = `${credentialForm.degree} from ${credentialForm.institution}, GPA: ${credentialForm.gpa}, Graduated: ${credentialForm.graduationYear}`;
      const hashedData = hashString(credentialData);

      // 1. Store on blockchain (on-chain hash)
      const tx = await contracts.digitalIdentity.StoreCredential(hashedType, hashedData);
      await tx.wait();

      // 2. Store off-chain via backend API (full JSON)
      try {
        const response = await fetch('http://localhost:3001/api/save-credential', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: wallet.address,
            credentialType: credentialForm.credentialType,
            degree: credentialForm.degree,
            institution: credentialForm.institution,
            gpa: credentialForm.gpa,
            graduationYear: credentialForm.graduationYear,
            studentName: identityForm.name || existingIdentity?.idHash || 'Anonymous'
          })
        });

        if (response.ok) {
          const result = await response.json();
          console.log('Credential saved off-chain:', result.filename);
        }
      } catch (apiErr) {
        console.error('Error saving to backend:', apiErr);
        setMessage({ type: 'error', text: 'Stored on-chain but failed to save off-chain. Make sure backend server is running.' });
        setLoading(false);
        return;
      }

      // Reload stored credentials to show the new one
      await loadStoredCredentials();

      setMessage({ type: 'success', text: `Credential stored on-chain and off-chain! Hash: ${hashedData.slice(0, 20)}...` });
      setCredentialForm({
        credentialType: '',
        degree: '',
        institution: '',
        gpa: '',
        graduationYear: ''
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Grant Consent (with rewards)
  const handleGrantConsent = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);

      // Check if recipient is registered
      const isRecipientRegistered = await contracts.digitalIdentity.IsRegistered(consentForm.recipientAddress);
      if (!isRecipientRegistered) {
        setMessage({ type: 'error', text: 'Recipient address is not registered in the system!' });
        setLoading(false);
        return;
      }

      const credentialTypeHash = hashString(consentForm.credentialType);
      const currentTime = Math.floor(Date.now() / 1000);
      const expiryTimestamp = currentTime + (parseInt(consentForm.duration) * 24 * 60 * 60);

      const tx = await contracts.dataSharing.GrantConsentAndReward(
        consentForm.recipientAddress,
        credentialTypeHash,
        expiryTimestamp
      );
      await tx.wait();

      await refreshBalance();
      await loadConsents(); // Reload consents list
      setMessage({ type: 'success', text: `Consent granted for ${consentForm.duration} days! You earned 10 EDUSHARE tokens!` });
      setConsentForm({ recipientAddress: '', duration: '30', credentialType: '' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Access Data
  const handleAccessData = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const credentialHash = await contracts.dataSharing.AccessData(
        accessForm.ownerAddress,
        hashString(accessForm.credentialHash)
      );

      setMessage({ type: 'success', text: `Access granted! Credential hash: ${credentialHash}` });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Revoke Consent
  const handleRevokeConsent = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);

      // Parse the selected value to get both recipient and credentialTypeHash
      const [recipient, credentialTypeHash] = revokeForm.recipientAddress.split('|');

      const tx = await contracts.dataSharing.RevokeConsentWrapper(recipient, credentialTypeHash);
      await tx.wait();

      await loadConsents(); // Reload consents list
      setMessage({ type: 'success', text: 'Consent revoked successfully!' });
      setRevokeForm({ recipientAddress: '', credentialTypeHash: '' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (!wallet) {
    return (
      <div className="app">
        <div className="container">
          <div className="card welcome-card">
            <h1>Welcome to EduChain</h1>
            <p>Decentralized Academic Credential Verification & Sharing Platform</p>

            {message.text && (
              <div className={`alert alert-${message.type}`}>
                {message.text}
              </div>
            )}

            <button
              className="btn btn-primary"
              onClick={handleConnect}
              disabled={loading}
            >
              {loading ? 'Connecting...' : 'Connect Wallet'}
            </button>

            <div className="info-box">
              <h3>Setup Instructions:</h3>
              <ol>
                <li>Install MetaMask browser extension</li>
                <li>Add Hardhat Network (Chain ID: 31337, RPC: http://127.0.0.1:8545)</li>
                <li>Import test account private key from Hardhat node</li>
                <li>Click "Connect Wallet"</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="header">
        <div className="container">
          <h1>EduChain</h1>
          <div className="wallet-info">
            <div>
              <small>Connected:</small>
              <div>{wallet.address}</div>
            </div>
            <div className="token-balance">
              {tokenBalance} EDUSHARE
            </div>
          </div>
        </div>
      </div>

      <div className="container">
        {message.text && (
          <div className={`alert alert-${message.type}`}>
            {message.text}
          </div>
        )}

        <div className="tabs">
          <button
            className={`tab ${activeTab === 'identity' ? 'active' : ''}`}
            onClick={() => setActiveTab('identity')}
          >
            Digital Identity
          </button>
          <button
            className={`tab ${activeTab === 'credentials' ? 'active' : ''}`}
            onClick={() => setActiveTab('credentials')}
          >
            Credentials
          </button>
          <button
            className={`tab ${activeTab === 'consent' ? 'active' : ''}`}
            onClick={() => setActiveTab('consent')}
          >
            Consent Management
          </button>
          <button
            className={`tab ${activeTab === 'myAccess' ? 'active' : ''}`}
            onClick={() => setActiveTab('myAccess')}
          >
            My Access
          </button>
          <button
            className={`tab ${activeTab === 'allUsers' ? 'active' : ''}`}
            onClick={() => setActiveTab('allUsers')}
          >
            All Users
          </button>
        </div>

        {activeTab === 'identity' && (
          <div className="card">
            <h2>Digital Identity</h2>

            {isRegistered && existingIdentity ? (
              <div>
                <div className="identity-status">
                  <div className="status-badge status-success">✓ Registered</div>
                  <p className="description">Your digital identity is registered on the blockchain.</p>
                </div>

                <div className="identity-info">
                  <h3>Identity Information</h3>
                  <div className="info-row">
                    <label>Name Hash:</label>
                    <code>{existingIdentity.idHash}</code>
                  </div>
                  <div className="info-row">
                    <label>Email Hash:</label>
                    <code>{existingIdentity.emailHash}</code>
                  </div>
                  <div className="info-row">
                    <label>Institution Hash:</label>
                    <code>{existingIdentity.studentIdHash}</code>
                  </div>
                  <div className="info-row">
                    <label>Registered At:</label>
                    <span>{existingIdentity.registeredAt}</span>
                  </div>
                  <small className="privacy-note">All data is stored as cryptographic hashes for privacy</small>
                </div>
              </div>
            ) : (
              <div>
                <p className="description">Register your identity on the blockchain. All data is hashed for privacy.</p>
                <form onSubmit={handleRegisterIdentity}>
                  <div className="form-group">
                    <label>Full Name</label>
                    <input
                      type="text"
                      value={identityForm.name}
                      onChange={(e) => setIdentityForm({...identityForm, name: e.target.value})}
                      placeholder="John Doe"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      value={identityForm.email}
                      onChange={(e) => setIdentityForm({...identityForm, email: e.target.value})}
                      placeholder="john@university.edu"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Institution</label>
                    <input
                      type="text"
                      value={identityForm.institution}
                      onChange={(e) => setIdentityForm({...identityForm, institution: e.target.value})}
                      placeholder="University of Technology"
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Registering...' : 'Register Identity'}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {activeTab === 'credentials' && (
          <div className="card">
            <h2>Academic Credentials</h2>

            {storedCredentials.length > 0 && (
              <div className="credentials-list">
                <h3>Stored Credentials (Off-chain)</h3>
                <p className="description">Credentials stored in the student_data folder</p>
                {storedCredentials.map((cred, index) => (
                  <div key={index} className="credential-item">
                    <div className="credential-header">
                      <strong>{cred.credentialType}</strong>
                      <span className="credential-filename">{cred.filename}</span>
                    </div>
                    <div className="credential-details">
                      <p><strong>Student:</strong> {cred.studentInfo?.name}</p>
                      <p><strong>Degree:</strong> {cred.degree?.type} in {cred.degree?.major}</p>
                      <p><strong>University:</strong> {cred.degree?.university}</p>
                      <p><strong>GPA:</strong> {cred.degree?.gpa}</p>
                      <p><strong>Issued:</strong> {new Date(cred.issuer?.issuedDate).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="section">
              <h3>Store New Credential On-Chain</h3>
              <p className="description">Store your academic credentials securely on the blockchain.</p>
              <form onSubmit={handleStoreCredential}>
                <div className="form-group">
                  <label>Credential Type</label>
                  <select
                    value={credentialForm.credentialType}
                    onChange={(e) => setCredentialForm({...credentialForm, credentialType: e.target.value})}
                    required
                  >
                    <option value="">Select type...</option>
                    <option value="degree">Degree</option>
                    <option value="certificate">Certificate</option>
                    <option value="transcript">Transcript</option>
                    <option value="diploma">Diploma</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Degree/Certificate Name</label>
                  <input
                    type="text"
                    value={credentialForm.degree}
                    onChange={(e) => setCredentialForm({...credentialForm, degree: e.target.value})}
                    placeholder="Bachelor of Science in Computer Science"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Institution</label>
                  <input
                    type="text"
                    value={credentialForm.institution}
                    onChange={(e) => setCredentialForm({...credentialForm, institution: e.target.value})}
                    placeholder="University of Technology"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>GPA</label>
                  <input
                    type="text"
                    value={credentialForm.gpa}
                    onChange={(e) => setCredentialForm({...credentialForm, gpa: e.target.value})}
                    placeholder="3.8"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Graduation Year</label>
                  <input
                    type="text"
                    value={credentialForm.graduationYear}
                    onChange={(e) => setCredentialForm({...credentialForm, graduationYear: e.target.value})}
                    placeholder="2024"
                    required
                  />
                  <small>All data will be hashed before storing on-chain</small>
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Storing...' : 'Store Credential'}
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'consent' && (
          <div className="card">
            <h2>Consent Management</h2>
            <p className="description">Grant or revoke access to your credentials. Earn 10 EDUSHARE tokens per consent!</p>

            <div className="section">
              <h3>Grant Consent</h3>
              <form onSubmit={handleGrantConsent}>
                <div className="form-group">
                  <label>Credential to Share</label>
                  <select
                    value={consentForm.credentialType}
                    onChange={(e) => setConsentForm({...consentForm, credentialType: e.target.value})}
                    required
                  >
                    <option value="">Select a credential...</option>
                    {storedCredentials.map((cred, index) => (
                      <option key={index} value={cred.credentialType.toLowerCase()}>
                        {cred.credentialType} - {cred.degree?.type} ({cred.degree?.university})
                      </option>
                    ))}
                  </select>
                  <small>Choose which credential to grant access to</small>
                </div>
                <div className="form-group">
                  <label>Recipient Address</label>
                  <select
                    value={consentForm.recipientAddress}
                    onChange={(e) => setConsentForm({...consentForm, recipientAddress: e.target.value})}
                    required
                  >
                    <option value="">Select a registered user...</option>
                    {allUsers.filter(u => u.address !== wallet?.address).map((user) => (
                      <option key={user.address} value={user.address}>
                        {user.address} (Registered: {user.registeredAt})
                      </option>
                    ))}
                  </select>
                  <small>Select from registered users who can access your credentials</small>
                </div>
                <div className="form-group">
                  <label>Duration (days)</label>
                  <input
                    type="number"
                    value={consentForm.duration}
                    onChange={(e) => setConsentForm({...consentForm, duration: e.target.value})}
                    min="1"
                    max="365"
                    required
                  />
                  <small>Access will expire after this period (1-365 days)</small>
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Granting...' : 'Grant Consent & Earn Tokens'}
                </button>
              </form>
            </div>

            {myGrantedConsents.length > 0 && (
              <div className="section">
                <h3>Consents I've Granted</h3>
                {myGrantedConsents.map((consent, index) => {
                  // Find the credential type name from stored credentials by matching the hash
                  const credentialType = storedCredentials.find(cred =>
                    hashString(cred.credentialType.toLowerCase()) === consent.credentialTypeHash
                  )?.credentialType || 'Unknown Credential';

                  return (
                    <div key={index} className="consent-item">
                      <p><strong>Credential:</strong> {credentialType}</p>
                      <p><strong>To:</strong> {consent.recipient}</p>
                      <p><strong>Granted:</strong> {consent.grantedAt}</p>
                      <p><strong>Expires:</strong> {consent.expiryDate}</p>
                      <p className={Date.now() / 1000 > consent.expiryTimestamp ? 'expired' : 'active'}>
                        Status: {Date.now() / 1000 > consent.expiryTimestamp ? 'Expired' : 'Active'}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="section">
              <h3>Revoke Consent</h3>
              <form onSubmit={handleRevokeConsent}>
                <div className="form-group">
                  <label>Select Consent to Revoke</label>
                  <select
                    value={revokeForm.recipientAddress}
                    onChange={(e) => setRevokeForm({...revokeForm, recipientAddress: e.target.value})}
                    required
                  >
                    <option value="">Select consent...</option>
                    {myGrantedConsents.filter(c => Date.now() / 1000 <= c.expiryTimestamp).map((consent, index) => {
                      // Find the credential type name from stored credentials by matching the hash
                      const credentialType = storedCredentials.find(cred =>
                        hashString(cred.credentialType.toLowerCase()) === consent.credentialTypeHash
                      )?.credentialType || 'Unknown';

                      return (
                        <option key={index} value={`${consent.recipient}|${consent.credentialTypeHash}`}>
                          {credentialType} → {consent.recipient.slice(0, 10)}...{consent.recipient.slice(-8)}
                        </option>
                      );
                    })}
                  </select>
                  <small>Shows credential type and recipient for active consents</small>
                </div>
                <button type="submit" className="btn btn-danger" disabled={loading}>
                  {loading ? 'Revoking...' : 'Revoke Consent'}
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'myAccess' && (
          <div className="card">
            <h2>My Access Rights</h2>
            <p className="description">View credentials that others have shared with you and when they expire.</p>

            {myReceivedConsents.length > 0 ? (
              <div className="consents-list">
                {myReceivedConsents.map((consent, index) => (
                  <div key={index} className="consent-item">
                    <div className="consent-header">
                      <strong>From: {consent.owner}</strong>
                      <span className={Date.now() / 1000 > consent.expiryTimestamp ? 'badge-expired' : 'badge-active'}>
                        {Date.now() / 1000 > consent.expiryTimestamp ? 'Expired' : 'Active'}
                      </span>
                    </div>
                    <div className="consent-details">
                      <p><strong>Granted:</strong> {consent.grantedAt}</p>
                      <p><strong>Expires:</strong> {consent.expiryDate}</p>
                      {Date.now() / 1000 <= consent.expiryTimestamp && (
                        <button
                          className="btn btn-primary"
                          style={{ marginTop: '12px' }}
                          onClick={async () => {
                            try {
                              setLoading(true);
                              setViewedCredential(null); // Clear previous view

                              // Access the credential hash on-chain (verifies consent)
                              const credentialHash = await contracts.dataSharing.AccessData(
                                consent.owner,
                                consent.credentialTypeHash
                              );

                              console.log('Access granted! Credential hash:', credentialHash);

                              // Fetch the actual credential JSON from backend
                              const response = await fetch(`http://localhost:3001/api/credentials/${consent.owner}`);
                              if (response.ok) {
                                const data = await response.json();

                                // Find the credential that matches the credentialTypeHash
                                const matchingCredential = data.credentials.find(cred =>
                                  hashString(cred.credentialType.toLowerCase()) === consent.credentialTypeHash
                                );

                                if (matchingCredential) {
                                  setViewedCredential(matchingCredential);
                                  setMessage({ type: 'success', text: 'Credential accessed successfully!' });
                                } else {
                                  setMessage({ type: 'error', text: 'No matching credential found for this consent.' });
                                }
                              } else {
                                setMessage({ type: 'error', text: 'Failed to fetch credential data.' });
                              }
                            } catch (err) {
                              setMessage({ type: 'error', text: err.message });
                            } finally {
                              setLoading(false);
                            }
                          }}
                        >
                          Access Credentials
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">No one has granted you access to their credentials yet.</p>
            )}

            {viewedCredential && (
              <div className="section">
                <h3>Accessed Credential</h3>
                <div className="credential-item">
                  <div className="credential-header">
                    <strong>{viewedCredential.credentialType}</strong>
                    <button
                      className="btn btn-danger"
                      style={{ padding: '4px 12px', fontSize: '12px' }}
                      onClick={() => setViewedCredential(null)}
                    >
                      Close
                    </button>
                  </div>
                  <div className="credential-details">
                    <p><strong>Student:</strong> {viewedCredential.studentInfo?.name}</p>
                    <p><strong>Wallet:</strong> {viewedCredential.studentInfo?.walletAddress}</p>
                    <p><strong>Degree:</strong> {viewedCredential.degree?.type} in {viewedCredential.degree?.major}</p>
                    <p><strong>University:</strong> {viewedCredential.degree?.university}</p>
                    <p><strong>GPA:</strong> {viewedCredential.degree?.gpa}</p>
                    <p><strong>Graduation Year:</strong> {viewedCredential.graduationYear}</p>
                    <p><strong>Issued By:</strong> {viewedCredential.issuer?.name}</p>
                    <p><strong>Issued Date:</strong> {new Date(viewedCredential.issuer?.issuedDate).toLocaleString()}</p>
                  </div>
                  <div style={{ marginTop: '16px' }}>
                    <p><strong>Full JSON:</strong></p>
                    <pre style={{
                      background: '#f8f9fa',
                      padding: '12px',
                      borderRadius: '8px',
                      overflow: 'auto',
                      fontSize: '12px',
                      border: '1px solid #e0e0e0'
                    }}>
                      {JSON.stringify(viewedCredential, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'allUsers' && (
          <div className="card">
            <h2>All Registered Users</h2>
            <p className="description">List of all users registered on the EduChain platform.</p>

            {allUsers.length > 0 ? (
              <div className="users-list">
                {allUsers.map((user, index) => (
                  <div key={index} className="user-item">
                    <div className="user-header">
                      <strong>{user.address}</strong>
                      <span className="user-date">{user.registeredAt}</span>
                    </div>
                    <div className="user-details">
                      <div className="info-row">
                        <label>Name Hash:</label>
                        <code>{user.idHash}</code>
                      </div>
                      <div className="info-row">
                        <label>Email Hash:</label>
                        <code>{user.emailHash}</code>
                      </div>
                      <div className="info-row">
                        <label>Institution Hash:</label>
                        <code>{user.studentIdHash}</code>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">No registered users found.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
