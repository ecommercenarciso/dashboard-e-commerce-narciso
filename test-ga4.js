import { BetaAnalyticsDataClient } from '@google-analytics/data';
import dotenv from 'dotenv';
dotenv.config();
const propertyId = process.env.GA4_PROPERTY_ID;
let authOptions = {};
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    authOptions = { credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) };
}
const analyticsDataClient = new BetaAnalyticsDataClient(authOptions);
async function run() {
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '2026-08-01', endDate: '2026-08-01' }],
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'totalUsers' }, { name: 'activeUsers' }, { name: 'sessions' }]
    });
    console.log(JSON.stringify(response.rows, null, 2));
}
run();
