const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

const API_URL = 'https://ai-resume-analyzer-nlp-1.onrender.com/api';
const EMAIL = `testuser_${Date.now()}@example.com`;
const PASSWORD = 'Password123!';

async function runTest() {
  console.log('1. Registering user...');
  let token;
  try {
    const res = await axios.post(`${API_URL}/auth/register`, {
      name: 'Test User',
      email: EMAIL,
      password: PASSWORD,
      confirmPassword: PASSWORD
    });
    token = res.data.token;
    console.log('User registered successfully.');
  } catch (e) {
    console.error('Registration failed:', e.response?.data || e.message);
    return;
  }

  console.log('2. Creating dummy PDF...');
  const pdfContent = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>\nendobj\n4 0 obj\n<< /Length 53 >>\nstream\nBT\n/F1 24 Tf\n100 700 Td\n(Software Engineer Resume Node React AWS MongoDB Python) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000288 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n390\n%%EOF';
  fs.writeFileSync('dummy_resume.pdf', pdfContent);

  console.log('3. Submitting analysis request...');
  let analysisId;
  try {
    const form = new FormData();
    form.append('resume', fs.createReadStream('dummy_resume.pdf'));
    form.append('jobTitle', 'Software Engineer');
    form.append('jobDescription', 'Looking for a Software Engineer with 3+ years of experience in Node.js, React, AWS, MongoDB, and Python. Must have strong communication skills and ability to work in a fast-paced environment. Responsibilities include building scalable web applications and maintaining existing codebases.');

    const res = await axios.post(`${API_URL}/analyze`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${token}`
      }
    });
    console.log('Analysis initiated:', res.data);
    analysisId = res.data.data.analysisId;
  } catch (e) {
    console.error('Analysis submission failed:', e.response?.data || e.message);
    return;
  }

  console.log('4. Polling for results...');
  for (let i = 0; i < 40; i++) { // Poll for up to 2 mins
    try {
      const res = await axios.get(`${API_URL}/history/${analysisId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const status = res.data.data.status;
      console.log(`[Attempt ${i+1}] Status: ${status}`);
      if (status === 'completed' || status === 'failed') {
        console.log('Final Result:', res.data.data);
        break;
      }
    } catch (e) {
      console.error('Polling error:', e.message);
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}

runTest();
