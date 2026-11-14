const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');
const FormData = require('form-data');

const API_URL = process.env.API_URL?.replace(/\/+$/, '');
const EMAIL = process.env.TEST_EMAIL || `testuser_${Date.now()}@example.com`;
const PASSWORD = process.env.TEST_PASSWORD || 'Password123!';

async function runTest() {
  if (!API_URL) {
    throw new Error('Set API_URL to the target API base URL (for example, http://127.0.0.1:5000/api).');
  }

  const resumePath = path.join(os.tmpdir(), `resumeiq-e2e-${Date.now()}.pdf`);
  let sessionCookie;
  let csrfCookie;
  let csrfToken;

  try {
  console.log('1. Registering user...');
  try {
    const res = await axios.post(`${API_URL}/auth/register`, {
      name: 'Test User',
      email: EMAIL,
      password: PASSWORD,
      confirmPassword: PASSWORD
    });
    const cookies = res.headers['set-cookie'] || [];
    sessionCookie = cookies.find((cookie) => cookie.startsWith('resumeiq_session='));
    csrfCookie = cookies.find((cookie) => cookie.startsWith('resumeiq_csrf='));
    csrfToken = csrfCookie?.split(';')[0].split('=')[1];
    if (!sessionCookie || !csrfToken) throw new Error('Expected session and CSRF cookies from registration.');
    console.log('User registered successfully.');
  } catch (e) {
    console.error('Registration failed:', e.response?.data || e.message);
    return;
  }

  console.log('2. Creating dummy PDF...');
  const pdfContent = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>\nendobj\n4 0 obj\n<< /Length 53 >>\nstream\nBT\n/F1 24 Tf\n100 700 Td\n(Software Engineer Resume Node React AWS MongoDB Python) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000288 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n390\n%%EOF';
  fs.writeFileSync(resumePath, pdfContent);
  const sessionHeader = sessionCookie.split(';')[0];
  const csrfHeader = csrfCookie.split(';')[0];

  console.log('2a. Verifying corrupted PDFs and missing CSRF are rejected...');
  const corruptedForm = new FormData();
  corruptedForm.append('resume', Buffer.from('not a PDF'), { filename: 'corrupted.pdf', contentType: 'application/pdf' });
  corruptedForm.append('jobTitle', 'Software Engineer');
  corruptedForm.append('jobDescription', 'A sufficiently detailed test job description for PDF validation coverage.');
  await axios.post(`${API_URL}/analyze`, corruptedForm, {
    headers: { ...corruptedForm.getHeaders(), Cookie: `${sessionHeader}; ${csrfHeader}`, 'X-CSRF-Token': csrfToken },
  }).then(() => {
    throw new Error('Corrupted PDF was accepted.');
  }).catch((error) => {
    if (error.response?.status !== 400) throw error;
  });

  const noCsrfForm = new FormData();
  noCsrfForm.append('resume', Buffer.from(pdfContent), { filename: 'resume.pdf', contentType: 'application/pdf' });
  noCsrfForm.append('jobTitle', 'Software Engineer');
  noCsrfForm.append('jobDescription', 'A sufficiently detailed test job description for CSRF validation coverage.');
  await axios.post(`${API_URL}/analyze`, noCsrfForm, {
    headers: { ...noCsrfForm.getHeaders(), Cookie: sessionHeader },
  }).then(() => {
    throw new Error('Missing CSRF token was accepted.');
  }).catch((error) => {
    if (error.response?.status !== 403) throw error;
  });

  console.log('3. Submitting analysis request...');
  let analysisId;
  let finalStatus;
  try {
    const form = new FormData();
    form.append('resume', fs.createReadStream(resumePath));
    form.append('jobTitle', 'Software Engineer');
    form.append('jobDescription', 'Looking for a Software Engineer with 3+ years of experience in Node.js, React, AWS, MongoDB, and Python. Must have strong communication skills and ability to work in a fast-paced environment. Responsibilities include building scalable web applications and maintaining existing codebases.');

    const res = await axios.post(`${API_URL}/analyze`, form, {
      headers: {
        ...form.getHeaders(),
        Cookie: `${sessionCookie.split(';')[0]}; ${csrfCookie.split(';')[0]}`,
        'X-CSRF-Token': csrfToken,
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
        headers: { Cookie: sessionCookie.split(';')[0] }
      });
      const status = res.data.data.status;
      console.log(`[Attempt ${i+1}] Status: ${status}`);
      if (status === 'completed' || status === 'failed') {
        finalStatus = status;
        console.log('Final Result:', res.data.data);
        break;
      }
    } catch (e) {
      console.error('Polling error:', e.message);
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  if (!analysisId) {
    throw new Error('Analysis did not return an ID.');
  }
  if (finalStatus !== 'completed') {
    throw new Error(`Analysis did not complete successfully (final status: ${finalStatus || 'timed out'}).`);
  }

  console.log('5. Verifying history and private resume download...');
  const history = await axios.get(`${API_URL}/history`, { headers: { Cookie: sessionHeader } });
  if (!history.data.data.some((analysis) => analysis._id === analysisId)) {
    throw new Error('Completed analysis was absent from user history.');
  }
  const download = await axios.get(`${API_URL}/history/${analysisId}/resume`, {
    headers: { Cookie: sessionHeader },
    responseType: 'arraybuffer',
  });
  if (!Buffer.from(download.data).subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    throw new Error('Private resume download did not return PDF bytes.');
  }

  console.log('6. Verifying CSRF-protected deletion and logout revocation...');
  await axios.delete(`${API_URL}/history/${analysisId}`, {
    headers: { Cookie: `${sessionHeader}; ${csrfHeader}`, 'X-CSRF-Token': csrfToken },
  });
  await axios.post(`${API_URL}/auth/logout`, null, {
    headers: { Cookie: `${sessionHeader}; ${csrfHeader}`, 'X-CSRF-Token': csrfToken },
  });
  await axios.get(`${API_URL}/auth/me`, { headers: { Cookie: sessionHeader } })
    .then(() => { throw new Error('Revoked session still authenticated.'); })
    .catch((error) => {
      if (error.response?.status !== 401) throw error;
    });
  console.log('E2E workflow passed.');
  } finally {
    if (fs.existsSync(resumePath)) fs.unlinkSync(resumePath);
  }
}

runTest();
