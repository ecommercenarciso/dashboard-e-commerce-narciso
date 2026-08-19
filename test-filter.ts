import dotenv from 'dotenv';
import { JWT } from 'google-auth-library';
dotenv.config();

function parseCredentialsJson(str) {
  try { return JSON.parse(str); }
  catch (e) {
    const recoveredStr = str.replace(/'/g, '"').replace(/“/g, '"').replace(/”/g, '"').replace(/‘/g, '"').replace(/’/g, '"');
    return JSON.parse(recoveredStr);
  }
}

async function getGoogleAccessToken(clientEmail, privateKey) {
  const jwtClient = new JWT({
    email: clientEmail,
    key: privateKey.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  });
  const tokens = await jwtClient.authorize();
  return tokens.access_token;
}

async function runTest() {
  const credsStr = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!credsStr) { console.error('No creds'); return; }
  
  const credentials = parseCredentialsJson(credsStr);
  const token = await getGoogleAccessToken(credentials.client_email, credentials.private_key);
  const propertyId = process.env.GA4_PROPERTY_ID.replace(/"/g, '').replace(/'/g, '');

  const body = {
    dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
    metrics: [{ name: 'sessions' }],
    dimensionFilter: {
      filter: { fieldName: 'country', stringFilter: { matchType: 'EXACT', value: 'Brazil' } }
    }
  };

  const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  
  const text = await response.text();
  console.log("GA4 RESPONSE:", text);
}

runTest().catch(console.error);
