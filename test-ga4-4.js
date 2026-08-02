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
    const [eventResponse] = await analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [
          {
            startDate: '2026-08-01',
            endDate: '2026-08-01',
          },
        ],
        dimensions: [
          {
            name: 'eventName',
          },
        ],
        metrics: [
          { name: 'totalUsers' },
        ],
      });
    console.log(JSON.stringify(eventResponse.rows, null, 2));
}
run();
