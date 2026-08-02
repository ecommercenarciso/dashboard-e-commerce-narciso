import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import axios from 'axios';

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper to check for missing env vars
const checkEnvVars = (vars: string[]) => {
  const missing = vars.filter(v => !process.env[v]);
  return missing;
};

// GA4 API Route
app.post('/api/ga4/metrics', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    
    // We expect the user to either set GOOGLE_APPLICATION_CREDENTIALS 
    // or GOOGLE_APPLICATION_CREDENTIALS_JSON in env
    const missing = checkEnvVars(['GA4_PROPERTY_ID']);
    if (missing.length > 0 || !process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      console.warn('Missing GA4 credentials. Returning mock data for visualization.');
      
      const mockData = [];
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate ? new Date(startDate) : new Date();
      if (!startDate) start.setDate(end.getDate() - 28);
      
      for(let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0].replace(/-/g, '');
          mockData.push({
              date: dateStr,
              sessions: Math.floor(Math.random() * 800) + 400,
              conversions: Math.floor(Math.random() * 40) + 5,
              revenue: Math.floor(Math.random() * 4000) + 500,
          });
      }
      return res.json(mockData);
    }

    let authOptions = {};
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
        authOptions = {
            credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
        };
    }

    const analyticsDataClient = new BetaAnalyticsDataClient(authOptions);
    const propertyId = process.env.GA4_PROPERTY_ID;

    const [response] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [
        {
          startDate: startDate || '28daysAgo',
          endDate: endDate || 'today',
        },
      ],
      dimensions: [
        {
          name: 'date',
        },
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'conversions' },
        { name: 'totalRevenue' },
      ],
      orderBys: [
          {
              dimension: { dimensionName: 'date' },
              desc: false
          }
      ]
    });

    const data = response.rows?.map(row => {
      return {
        date: row.dimensionValues?.[0].value,
        sessions: parseInt(row.metricValues?.[0].value || '0', 10),
        conversions: parseInt(row.metricValues?.[1].value || '0', 10),
        revenue: parseFloat(row.metricValues?.[2].value || '0'),
      };
    }) || [];

    res.json(data);
  } catch (error: any) {
    console.error('GA4 Error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch GA4 data' });
  }
});

// GA4 Funnel API Route
app.post('/api/ga4/funnel', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    
    const missing = checkEnvVars(['GA4_PROPERTY_ID']);
    if (missing.length > 0 || !process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      console.warn('Missing GA4 credentials. Returning mock data for funnel.');
      
      const mockFunnel = {
        visitors: Math.floor(Math.random() * 10000) + 5000,
        viewItem: Math.floor(Math.random() * 5000) + 2000,
        cart: Math.floor(Math.random() * 2000) + 500,
        shipping: Math.floor(Math.random() * 1000) + 200,
        payment: Math.floor(Math.random() * 500) + 100
      };
      
      // Ensure the funnel makes sense (values decrease)
      mockFunnel.viewItem = Math.min(mockFunnel.visitors, mockFunnel.viewItem);
      mockFunnel.cart = Math.min(mockFunnel.viewItem, mockFunnel.cart);
      mockFunnel.shipping = Math.min(mockFunnel.cart, mockFunnel.shipping);
      mockFunnel.payment = Math.min(mockFunnel.shipping, mockFunnel.payment);

      return res.json(mockFunnel);
    }

    let authOptions = {};
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
        authOptions = {
            credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
        };
    }

    const analyticsDataClient = new BetaAnalyticsDataClient(authOptions);
    const propertyId = process.env.GA4_PROPERTY_ID;

    // To get the funnel, we need distinct users for each event
    // Note: 'activeUsers' or 'totalUsers' filtered by event_name is typically used.
    // We'll use a single report with eventName dimension and activeUsers metric.
    const [
      [overallResponse], 
      [eventResponse]
    ] = await Promise.all([
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

    // Combine view_cart and add_to_cart (max of both or just add_to_cart as a proxy if we want unique users, but max is a safe bet for a proxy)
    funnel.cart = viewCartUsers;

    res.json(funnel);
  } catch (error: any) {
    console.error('GA4 Funnel Error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch GA4 funnel data' });
  }
});

// VTEX API Routes
app.post('/api/vtex/orders', async (req, res) => {
  try {
    const { startDate, endDate, category } = req.body;
    
    const missing = checkEnvVars(['VTEX_ACCOUNT_NAME', 'VTEX_APP_KEY', 'VTEX_APP_TOKEN']);
    if (missing.length > 0) {
      console.warn('Missing VTEX credentials. Returning mock data for visualization.');
      
      const mockOrders = Array.from({ length: 50 }).map((_, i) => ({
        orderId: `v-${1000000000 + Math.floor(Math.random() * 9000000000)}`,
        creationDate: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString(),
        clientName: `Cliente Exemplo ${i + 1}`,
        totalValue: (Math.floor(Math.random() * 1500) + 50) * 100,
        status: ['invoiced', 'handling', 'canceled', 'payment-pending'][Math.floor(Math.random() * 4)],
        items: [
          { name: 'Produto Exemplo', quantity: 1, price: 100 }
        ]
      }));
      
      return res.json({ list: mockOrders });
    }

    const accountName = process.env.VTEX_ACCOUNT_NAME;
    const environment = process.env.VTEX_ENVIRONMENT || 'vtexcommercestable';
    
    // Convert startDate and endDate to ISO string as required by VTEX API usually
    let fq = '';
    if (startDate && endDate) {
        fq = `creationDate:[${startDate}T00:00:00.000Z TO ${endDate}T23:59:59.999Z]`;
    }

    const response = await axios.get(
      `https://${accountName}.${environment}.com.br/api/oms/pvt/orders`,
      {
        params: {
          f_creationDate: fq ? fq : undefined,
          per_page: 100, // Fetch up to 100 recent orders for summary
        },
        headers: {
          'X-VTEX-API-AppKey': process.env.VTEX_APP_KEY,
          'X-VTEX-API-AppToken': process.env.VTEX_APP_TOKEN,
          'Accept': 'application/json'
        }
      }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error('VTEX Error:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message || 'Failed to fetch VTEX data' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
