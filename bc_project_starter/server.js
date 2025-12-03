const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve student_data folder
app.use('/student_data', express.static(path.join(__dirname, 'student_data')));

// API endpoint to save credential
app.post('/api/save-credential', async (req, res) => {
  try {
    const { walletAddress, credentialType, degree, institution, gpa, graduationYear, studentName } = req.body;

    // Create credential object
    const credential = {
      credentialType: credentialType.charAt(0).toUpperCase() + credentialType.slice(1),
      studentInfo: {
        name: studentName || 'Anonymous',
        walletAddress: walletAddress
      },
      degree: {
        type: degree,
        major: degree.split(' in ')[1] || degree,
        university: institution,
        gpa: gpa
      },
      issuer: {
        name: `${institution} Registrar`,
        issuedDate: new Date().toISOString()
      },
      graduationYear: graduationYear
    };

    // Generate filename using last 8 chars of wallet address
    const addressSuffix = walletAddress.slice(-8);
    const timestamp = Date.now();
    const filename = `${credentialType}_${addressSuffix}_${timestamp}.json`;
    const filepath = path.join(__dirname, 'student_data', filename);

    // Ensure student_data directory exists
    const dirPath = path.join(__dirname, 'student_data');
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // Write file
    fs.writeFileSync(filepath, JSON.stringify(credential, null, 2));

    console.log(`Credential saved: ${filename}`);

    res.json({
      success: true,
      filename: filename,
      message: 'Credential saved successfully'
    });

  } catch (error) {
    console.error('Error saving credential:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API endpoint to list all credentials
app.get('/api/credentials', (req, res) => {
  try {
    const dirPath = path.join(__dirname, 'student_data');

    if (!fs.existsSync(dirPath)) {
      return res.json({ credentials: [] });
    }

    const files = fs.readdirSync(dirPath)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const content = fs.readFileSync(path.join(dirPath, file), 'utf8');
        return {
          filename: file,
          ...JSON.parse(content)
        };
      });

    res.json({ credentials: files });
  } catch (error) {
    console.error('Error listing credentials:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API endpoint to get credentials for a specific wallet
app.get('/api/credentials/:walletAddress', (req, res) => {
  try {
    const { walletAddress } = req.params;
    const dirPath = path.join(__dirname, 'student_data');

    if (!fs.existsSync(dirPath)) {
      return res.json({ credentials: [] });
    }

    const files = fs.readdirSync(dirPath)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const content = fs.readFileSync(path.join(dirPath, file), 'utf8');
        return {
          filename: file,
          ...JSON.parse(content)
        };
      })
      .filter(cred => cred.studentInfo?.walletAddress?.toLowerCase() === walletAddress.toLowerCase());

    res.json({ credentials: files });
  } catch (error) {
    console.error('Error fetching credentials:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log(`Student data API: http://localhost:${PORT}/api/credentials`);
});
