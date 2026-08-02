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

    const funnel = {
        visitors: 0,
        viewItem: 0,
        cart: 0,
        shipping: 0,
        payment: 0
    };

    if (overallResponse.rows && overallResponse.rows.length > 0) {
        funnel.visitors = parseInt(overallResponse.rows[0].metricValues[0].value, 10);
    }

    let viewCartUsers = 0;
    let addToCartUsers = 0;

    if (eventResponse.rows) {
        eventResponse.rows.forEach(row => {
            const eventName = row.dimensionValues[0].value;
            const users = parseInt(row.metricValues[0].value, 10);
            
            if (eventName === 'view_item') funnel.viewItem = users;
            if (eventName === 'Checkout Carrinho' || eventName === 'add_to_cart') viewCartUsers = Math.max(viewCartUsers, users);
            if (eventName === 'Checkout Entrega') funnel.shipping = users;
            if (eventName === 'Checkout Pagamento') funnel.payment = users;
        });
    }

    funnel.cart = viewCartUsers;
    console.log("FINAL FUNNEL:", JSON.stringify(funnel, null, 2));
}

run().catch(console.error);
