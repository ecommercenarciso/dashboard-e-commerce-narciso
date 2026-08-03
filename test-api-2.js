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
    const startDate = "2026-08-01";
    const endDate = "2026-08-01";
    
    const [overallResponse, eventResponse] = await Promise.all([
      analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [
          {
            startDate: startDate || '28daysAgo',
            endDate: endDate || 'today',
          },
        ],
        metrics: [
          { name: 'totalUsers' },
        ],
      }),
      analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [
          {
            startDate: startDate || '28daysAgo',
            endDate: endDate || 'today',
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
      })
    ]);

    console.log("overall", JSON.stringify(overallResponse.rows));
    console.log("events", JSON.stringify(eventResponse.rows));
}

run().catch(console.error);
