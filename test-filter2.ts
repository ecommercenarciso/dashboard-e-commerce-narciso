import fs from 'fs';
import { JWT } from 'google-auth-library';

async function runTest() {
  const envContent = fs.readFileSync('.env', 'utf-8');
  let credsStr = '';
  let propId = '';
  envContent.split('\n').forEach(line => {
    if (line.startsWith('GOOGLE_APPLICATION_CREDENTIALS_JSON=')) {
      credsStr = line.split('=')[1].trim();
      if (credsStr.startsWith('"') || credsStr.startsWith("'")) {
        credsStr = credsStr.slice(1, -1);
      }
    }
    if (line.startsWith('GA4_PROPERTY_ID=')) {
      propId = line.split('=')[1].trim();
      if (propId.startsWith('"') || propId.startsWith("'")) {
        propId = propId.slice(1, -1);
      }
    }
  });

  const credentials = JSON.parse(credsStr.replace(/\\\\n/g, '\\n'));
  
  const jwtClient = new JWT({
    email: credentials.client_email,
    key: credentials.private_key.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  });
  const tokens = await jwtClient.authorize();
  const token = tokens.access_token;
  
  const body = {
    dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
    dimensions: [
      { name: 'sessionSource' },
      { name: 'sessionMedium' },
      { name: 'campaignName' },
      { name: 'searchTerm' },
      { name: 'contentGroup' },
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'conversions' },
      { name: 'totalRevenue' },
      { name: 'advertiserAdCost' },
    ],
    dimensionFilter: {
      filter: { fieldName: 'country', stringFilter: { matchType: 'EXACT', value: 'Brazil' } }
    }
  };

  const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propId}:runReport`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  
  const text = await response.text();
  console.log("GA4 RESPONSE WITHOUT ERROR:", text);
}

runTest().catch(console.error);
