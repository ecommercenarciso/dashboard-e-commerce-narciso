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
    const [overallResponse] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '2026-08-01', endDate: '2026-08-01' }],
      metrics: [{ name: 'totalUsers' }]
    });
    console.log("Overall:", JSON.stringify(overallResponse.rows, null, 2));

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
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            inListFilter: {
              values: ['view_item', 'add_to_cart', 'Checkout Carrinho', 'Checkout Entrega', 'Checkout Pagamento', 'Checkout Identificação', 'begin_checkout']
            }
          }
        }
      });
    console.log("Events:", JSON.stringify(eventResponse.rows, null, 2));
}
run();
