import { BetaAnalyticsDataClient } from '@google-analytics/data';
import dotenv from 'dotenv';
dotenv.config();
const propertyId = process.env.GA4_PROPERTY_ID;
let authOptions = {};
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    const sanitized = raw.replace(/\n/g, '\\n');
    authOptions = { credentials: JSON.parse(sanitized) };
}
const analyticsDataClient = new BetaAnalyticsDataClient(authOptions);
async function run() {
    const [overallResponse] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '2026-08-15', endDate: 'today' }],
      metrics: [{ name: 'totalUsers' }]
    });
    console.log("Overall:", JSON.stringify(overallResponse.rows, null, 2));

    const [eventResponse] = await analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [
          {
            startDate: '2026-08-15',
            endDate: 'today',
          },
        ],
        dimensions: [
          {
            name: 'eventName',
          },
        ],
        metrics: [
          { name: 'totalUsers' },
        ]
      });
    console.log("Events:", JSON.stringify(eventResponse.rows, null, 2));
}
run();
