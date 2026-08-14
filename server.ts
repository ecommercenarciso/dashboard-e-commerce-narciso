import { Hono } from 'hono';
import axios from 'axios';

type Bindings = {
  GA4_PROPERTY_ID: string;
  GOOGLE_APPLICATION_CREDENTIALS_JSON: string;
  VTEX_ACCOUNT_NAME: string;
  VTEX_APP_KEY: string;
  VTEX_APP_TOKEN: string;
  VTEX_ENVIRONMENT?: string;
  GEMINI_API_KEY?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Helper to get environment variables
const getEnv = (c: any, key: keyof Bindings): string | undefined => {
  return c.env?.[key] || process.env[key];
};

const checkEnvVars = (c: any, vars: (keyof Bindings)[]) => {
  return vars.filter(v => !getEnv(c, v));
};

const clampEndDate = (endDate: string | undefined): string => {
  if (!endDate) return 'today';
  const todayStr = new Date().toISOString().split('T')[0];
  if (endDate > todayStr) {
    return todayStr;
  }
  return endDate;
};

// Helper function to sign JWT and retrieve access token for Google API
async function getGoogleAccessToken(clientEmail: string, privateKeyStr: string): Promise<string> {
  const pemContents = privateKeyStr
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  
  // Convert base64 to ArrayBuffer
  const binaryDerString = atob(pemContents);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const base64UrlEncode = (str: string) => {
    return btoa(str)
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  };

  const tokenParts = [
    base64UrlEncode(JSON.stringify(header)),
    base64UrlEncode(JSON.stringify(payload)),
  ];

  const stringToSign = tokenParts.join(".");
  const encoder = new TextEncoder();
  const dataToSign = encoder.encode(stringToSign);

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    dataToSign
  );

  const base64UrlSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  tokenParts.push(base64UrlSignature);
  const jwt = tokenParts.join(".");

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString(),
  });

  const tokenData = await tokenResponse.json() as any;
  if (!tokenResponse.ok) {
    throw new Error(`Failed to get Google Access Token: ${JSON.stringify(tokenData)}`);
  }

  return tokenData.access_token;
}

function parseCredentialsJson(jsonStr: string): any {
  let cleanStr = jsonStr.trim();

  // Remove outer wrapper quotes if the user pasted the JSON wrapped in quotes (from .env or config files)
  if (cleanStr.startsWith("'") && cleanStr.endsWith("'")) {
    cleanStr = cleanStr.slice(1, -1).trim();
  }
  if (cleanStr.startsWith('`') && cleanStr.endsWith('`')) {
    cleanStr = cleanStr.slice(1, -1).trim();
  }
  
  // For double quotes: only strip them if the resulting string starts with '{' and ends with '}'
  // to avoid stripping internal quotes from a raw unquoted JSON.
  if (cleanStr.startsWith('"') && cleanStr.endsWith('"')) {
    const candidate = cleanStr.slice(1, -1).trim();
    if (candidate.startsWith('{') && candidate.endsWith('}')) {
      cleanStr = candidate;
    }
  }

  // Double check if there's any remaining single quote or double quote wrapping because of asymmetric copy-paste
  if (cleanStr.startsWith("'")) {
    cleanStr = cleanStr.substring(1).trim();
  }
  if (cleanStr.endsWith("'")) {
    cleanStr = cleanStr.slice(0, -1).trim();
  }
  if (cleanStr.startsWith('"') && cleanStr.endsWith('}')) {
    // If it still starts with " but ends with }, strip the leading "
    cleanStr = cleanStr.substring(1).trim();
  }

  try {
    return JSON.parse(cleanStr);
  } catch (err: any) {
    // Attempt auto-recovery for single quotes or copy-paste smart quote mutations
    try {
      const recoveredStr = cleanStr
        .replace(/'/g, '"') 
        .replace(/“/g, '"') 
        .replace(/”/g, '"')
        .replace(/‘/g, '"')
        .replace(/’/g, '"');
      return JSON.parse(recoveredStr);
    } catch (recoveryErr) {
      const snippet = cleanStr.substring(0, 40);
      throw new Error(`Credencial JSON inválida (Inicia com: "${snippet}", Comprimento: ${cleanStr.length}). Certifique-se de colar o arquivo JSON original do Google Cloud com aspas duplas ("). Detalhes do erro original: ${err.message}`);
    }
  }
}

function cleanEnvString(val: string | undefined): string | undefined {
  if (!val) return val;
  let clean = val.trim();
  if (clean.startsWith('"') && clean.endsWith('"')) {
    clean = clean.slice(1, -1).trim();
  }
  if (clean.startsWith("'") && clean.endsWith("'")) {
    clean = clean.slice(1, -1).trim();
  }
  return clean;
}

// Helper to query GA4 Data API via REST
async function runGa4Report(accessToken: string, propertyId: string, reportBody: any) {
  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reportBody),
    }
  );
  
  const data = await response.json() as any;
  if (!response.ok) {
    throw new Error(`GA4 API Error: ${JSON.stringify(data)}`);
  }
  return data;
}

// GA4 API Route
app.post('/api/ga4/metrics', async (c) => {
  try {
    const { startDate, endDate } = await c.req.json();
    
    const missing = checkEnvVars(c, ['GA4_PROPERTY_ID']);
    const credentialsJson = getEnv(c, 'GOOGLE_APPLICATION_CREDENTIALS_JSON');
    
    if (missing.length > 0 || !credentialsJson) {
      console.warn('Missing GA4 credentials. Returning mock data for visualization.');
      
      const mockData = [];
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate ? new Date(startDate) : new Date();
      if (!startDate) start.setDate(end.getDate() - 28);
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0].replace(/-/g, '');
          for (let h = 0; h < 24; h++) {
              const hourStr = String(h).padStart(2, '0');
              const baseVisitors = Math.floor(Math.random() * 40) + 10;
              const viewItem = Math.floor(baseVisitors * (Math.random() * 0.2 + 0.4));
              const addToCart = Math.floor(viewItem * (Math.random() * 0.15 + 0.1));
              const beginCheckout = Math.floor(addToCart * (Math.random() * 0.3 + 0.1));
              const purchase = Math.floor(beginCheckout * (Math.random() * 0.5 + 0.5));

              mockData.push({
                  date: dateStr,
                  hour: hourStr,
                  sessions: Math.floor(baseVisitors * 1.2),
                  conversions: purchase,
                  revenue: purchase * 150,
                  visitors: baseVisitors,
                  viewItem: viewItem,
                  cart: addToCart,
                  shipping: beginCheckout,
                  payment: purchase
              });
          }
      }
      return c.json(mockData);
    }

    const credentials = parseCredentialsJson(credentialsJson);
    const accessToken = await getGoogleAccessToken(credentials.client_email, credentials.private_key);
    const propertyId = cleanEnvString(getEnv(c, 'GA4_PROPERTY_ID'));

    const startStr = startDate || '28daysAgo';
    const endStr = clampEndDate(endDate);

    // Calculate if we should fetch hourly data (only for ranges <= 7 days to avoid timeouts)
    let useHourly = true;
    if (startStr.includes('daysAgo')) {
      const days = parseInt(startStr.replace('daysAgo', ''), 10);
      if (days > 7) useHourly = false;
    } else {
      try {
        const startObj = new Date(startStr);
        const endObj = new Date(endStr);
        const diffTime = Math.abs(endObj.getTime() - startObj.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 7) useHourly = false;
      } catch (e) {
        useHourly = false;
      }
    }

    // Run parallel reports: one for general metrics and unique visitors, one for specific event counts (unique users)
    const [responseGeneral, responseEvents] = await Promise.all([
      runGa4Report(accessToken, propertyId!, {
        dateRanges: [
          {
            startDate: startStr,
            endDate: endStr,
          },
        ],
        dimensions: useHourly ? [{ name: 'date' }, { name: 'hour' }] : [{ name: 'date' }],
        metrics: [
          { name: 'sessions' },
          { name: 'conversions' },
          { name: 'totalRevenue' },
          { name: 'totalUsers' },
        ],
      }),
      runGa4Report(accessToken, propertyId!, {
        dateRanges: [
          {
            startDate: startStr,
            endDate: endStr,
          },
        ],
        dimensions: useHourly ? [{ name: 'date' }, { name: 'hour' }, { name: 'eventName' }] : [{ name: 'date' }, { name: 'eventName' }],
        metrics: [{ name: 'totalUsers' }], // Query unique users per event
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            inListFilter: {
              values: ['view_item', 'add_to_cart', 'Checkout Carrinho', 'Checkout Entrega', 'Checkout Pagamento', 'begin_checkout']
            }
          }
        }
      })
    ]);

    const dateMap: { [key: string]: any } = {};

    responseGeneral.rows?.forEach((row: any) => {
      const date = row.dimensionValues?.[0].value;
      const hour = useHourly ? String(row.dimensionValues?.[1].value || '00').padStart(2, '0') : '00';
      const key = `${date}_${hour}`;
      dateMap[key] = {
        date,
        hour,
        sessions: parseInt(row.metricValues?.[0].value || '0', 10),
        conversions: parseInt(row.metricValues?.[1].value || '0', 10),
        revenue: parseFloat(row.metricValues?.[2].value || '0'),
        visitors: parseInt(row.metricValues?.[3].value || '0', 10),
        viewItem: 0,
        cart: 0,
        shipping: 0,
        payment: 0
      };
    });

    responseEvents.rows?.forEach((row: any) => {
      const date = row.dimensionValues?.[0].value;
      const hour = useHourly ? String(row.dimensionValues?.[1].value || '00').padStart(2, '0') : '00';
      const eventName = useHourly ? row.dimensionValues?.[2].value : row.dimensionValues?.[1].value;
      const users = parseInt(row.metricValues?.[0].value || '0', 10);
      const key = `${date}_${hour}`;

      if (dateMap[key]) {
        if (eventName === 'view_item') {
          dateMap[key].viewItem = users;
        } else if (eventName === 'Checkout Carrinho' || eventName === 'add_to_cart') {
          dateMap[key].cart = Math.max(dateMap[key].cart, users);
        } else if (eventName === 'Checkout Entrega') {
          dateMap[key].shipping = users;
        } else if (eventName === 'Checkout Pagamento') {
          dateMap[key].payment = users;
        }
      }
    });

    // Enforce funnel cascading rules by date+hour to avoid crossovers (visitors >= viewItem >= cart >= shipping >= payment)
    Object.keys(dateMap).forEach((key) => {
      const d = dateMap[key];
      d.viewItem = Math.min(d.visitors, d.viewItem);
      d.cart = Math.min(d.viewItem, d.cart);
      d.shipping = Math.min(d.cart, d.shipping);
      d.payment = Math.min(d.shipping, d.payment);
    });

    const data = Object.values(dateMap).sort((a: any, b: any) => `${a.date}_${a.hour}`.localeCompare(`${b.date}_${b.hour}`));
    return c.json(data);
  } catch (error: any) {
    console.error('GA4 Error:', error);
    return c.json({ error: error.message || 'Failed to fetch GA4 data' }, 500);
  }
});

// GA4 Funnel API Route
app.post('/api/ga4/funnel', async (c) => {
  try {
    const { startDate, endDate } = await c.req.json();
    
    const missing = checkEnvVars(c, ['GA4_PROPERTY_ID']);
    const credentialsJson = getEnv(c, 'GOOGLE_APPLICATION_CREDENTIALS_JSON');
    
    if (missing.length > 0 || !credentialsJson) {
      console.warn('Missing GA4 credentials. Returning mock data for funnel.');
      
      const mockFunnel = {
        visitors: Math.floor(Math.random() * 10000) + 5000,
        viewItem: Math.floor(Math.random() * 5000) + 2000,
        cart: Math.floor(Math.random() * 2000) + 500,
        shipping: Math.floor(Math.random() * 1000) + 200,
        payment: Math.floor(Math.random() * 500) + 100
      };
      
      mockFunnel.viewItem = Math.min(mockFunnel.visitors, mockFunnel.viewItem);
      mockFunnel.cart = Math.min(mockFunnel.viewItem, mockFunnel.cart);
      mockFunnel.shipping = Math.min(mockFunnel.cart, mockFunnel.shipping);
      mockFunnel.payment = Math.min(mockFunnel.shipping, mockFunnel.payment);

      return c.json(mockFunnel);
    }

    const credentials = parseCredentialsJson(credentialsJson);
    const accessToken = await getGoogleAccessToken(credentials.client_email, credentials.private_key);
    const propertyId = cleanEnvString(getEnv(c, 'GA4_PROPERTY_ID'));

    const [overallResponse, eventResponse] = await Promise.all([
      runGa4Report(accessToken, propertyId!, {
        dateRanges: [
          {
            startDate: startDate || '28daysAgo',
            endDate: clampEndDate(endDate),
          },
        ],
        metrics: [
          { name: 'totalUsers' },
        ],
      }),
      runGa4Report(accessToken, propertyId!, {
        dateRanges: [
          {
            startDate: startDate || '28daysAgo',
            endDate: clampEndDate(endDate),
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

    if (eventResponse.rows) {
        eventResponse.rows.forEach((row: any) => {
            const eventName = row.dimensionValues[0].value;
            const users = parseInt(row.metricValues[0].value, 10);
            
            if (eventName === 'view_item') funnel.viewItem = users;
            if (eventName === 'Checkout Carrinho' || eventName === 'add_to_cart') viewCartUsers = Math.max(viewCartUsers, users);
            if (eventName === 'Checkout Entrega') funnel.shipping = users;
            if (eventName === 'Checkout Pagamento') funnel.payment = users;
        });
    }

    funnel.cart = viewCartUsers;

    return c.json(funnel);
  } catch (error: any) {
    console.error('GA4 Funnel Error:', error);
    return c.json({ error: error.message || 'Failed to fetch GA4 funnel data' }, 500);
  }
});

// VTEX API Routes
app.post('/api/vtex/orders', async (c) => {
  try {
    const { startDate, endDate, prevStartDate, prevEndDate, category } = await c.req.json();
    
    const missing = checkEnvVars(c, ['VTEX_ACCOUNT_NAME', 'VTEX_APP_KEY', 'VTEX_APP_TOKEN']);
    if (missing.length > 0) {
      console.warn('Missing VTEX credentials. Returning mock data for visualization.');
      
      const currentOrdersCount = 40;
      const prevOrdersCount = 30;
      
      const mockCurrent = Array.from({ length: currentOrdersCount }).map((_, i) => {
        const itemQuantity = Math.floor(Math.random() * 3) + 1;
        const itemPrice = (Math.floor(Math.random() * 200) + 10) * 100;
        const shippingValue = Math.random() > 0.3 ? (Math.floor(Math.random() * 30) + 10) * 100 : 0;
        const deliveryChannel = Math.random() > 0.3 ? 'delivery' : 'pickup-in-point';
        const totalValue = (itemPrice * itemQuantity) + (deliveryChannel === 'delivery' ? shippingValue : 0);
        
        const startMs = new Date(startDate).getTime();
        const endMs = new Date(endDate).getTime();
        const randDate = new Date(startMs + Math.random() * (endMs - startMs));
        
        return {
          orderId: `v-${1000000000 + Math.floor(Math.random() * 9000000000)}`,
          creationDate: randDate.toISOString(),
          clientName: `Cliente Exemplo ${i + 1}`,
          totalValue: totalValue,
          status: ['invoiced', 'handling', 'canceled', 'payment-pending'][Math.floor(Math.random() * 4)],
          items: [
            { name: 'Produto Exemplo', quantity: itemQuantity, price: itemPrice, sellingPrice: itemPrice }
          ],
          shippingValue: deliveryChannel === 'delivery' ? shippingValue : 0,
          deliveryChannel: deliveryChannel
        };
      });

      const mockPrev = prevStartDate && prevEndDate ? Array.from({ length: prevOrdersCount }).map((_, i) => {
        const itemQuantity = Math.floor(Math.random() * 2) + 1;
        const itemPrice = (Math.floor(Math.random() * 150) + 10) * 100;
        const shippingValue = Math.random() > 0.3 ? (Math.floor(Math.random() * 25) + 10) * 100 : 0;
        const deliveryChannel = Math.random() > 0.3 ? 'delivery' : 'pickup-in-point';
        const totalValue = (itemPrice * itemQuantity) + (deliveryChannel === 'delivery' ? shippingValue : 0);
        
        const startMs = new Date(prevStartDate).getTime();
        const endMs = new Date(prevEndDate).getTime();
        const randDate = new Date(startMs + Math.random() * (endMs - startMs));
        
        return {
          orderId: `v-${1000000000 + Math.floor(Math.random() * 9000000000)}`,
          creationDate: randDate.toISOString(),
          clientName: `Cliente Antigo ${i + 1}`,
          totalValue: totalValue,
          status: ['invoiced', 'handling', 'canceled', 'payment-pending'][Math.floor(Math.random() * 4)],
          items: [
            { name: 'Produto Exemplo Antigo', quantity: itemQuantity, price: itemPrice, sellingPrice: itemPrice }
          ],
          shippingValue: deliveryChannel === 'delivery' ? shippingValue : 0,
          deliveryChannel: deliveryChannel
        };
      }) : [];
      
      return c.json({ list: [...mockCurrent, ...mockPrev] });
    }

    const accountName = cleanEnvString(getEnv(c, 'VTEX_ACCOUNT_NAME'));
    const environment = cleanEnvString(getEnv(c, 'VTEX_ENVIRONMENT')) || 'vtexcommercestable';

    const currentFq = `creationDate:[${startDate}T00:00:00.000Z TO ${endDate}T23:59:59.999Z]`;

    const currentPromise = axios.get(
      `https://${accountName}.${environment}.com.br/api/oms/pvt/orders`,
      {
        params: {
          f_creationDate: currentFq,
          per_page: 100,
        },
        headers: {
          'X-VTEX-API-AppKey': cleanEnvString(getEnv(c, 'VTEX_APP_KEY')),
          'X-VTEX-API-AppToken': cleanEnvString(getEnv(c, 'VTEX_APP_TOKEN')),
          'Accept': 'application/json'
        }
      }
    );

    const prevPromise = prevStartDate && prevEndDate
      ? axios.get(
          `https://${accountName}.${environment}.com.br/api/oms/pvt/orders`,
          {
            params: {
              f_creationDate: `creationDate:[${prevStartDate}T00:00:00.000Z TO ${prevEndDate}T23:59:59.999Z]`,
              per_page: 100,
            },
            headers: {
              'X-VTEX-API-AppKey': cleanEnvString(getEnv(c, 'VTEX_APP_KEY')),
              'X-VTEX-API-AppToken': cleanEnvString(getEnv(c, 'VTEX_APP_TOKEN')),
              'Accept': 'application/json'
            }
          }
        )
      : Promise.resolve({ data: { list: [] } });

    const [currentRes, prevRes] = await Promise.all([currentPromise, prevPromise]);

    const currentList = currentRes.data.list || [];
    const prevList = prevRes.data.list || [];

    // Only request details for the top 5 orders of the CURRENT period to avoid rate limits
    const ordersToFetch = currentList.slice(0, 5);
    
    const detailedOrders = await Promise.all(
      ordersToFetch.map(async (order: any) => {
        try {
          const detailResponse = await axios.get(
            `https://${accountName}.${environment}.com.br/api/oms/pvt/orders/${order.orderId}`,
            {
              headers: {
                'X-VTEX-API-AppKey': cleanEnvString(getEnv(c, 'VTEX_APP_KEY')),
                'X-VTEX-API-AppToken': cleanEnvString(getEnv(c, 'VTEX_APP_TOKEN')),
                'Accept': 'application/json'
              }
            }
          );
          const o = detailResponse.data;
          
          const shippingTotal = o.totals?.find((t: any) => t.id === 'Shipping')?.value || 0;
          const deliveryChannel = o.shippingData?.logisticsInfo?.[0]?.deliveryChannel || 'delivery';

          return {
            orderId: o.orderId,
            creationDate: o.creationDate,
            clientName: o.clientProfileData ? `${o.clientProfileData.firstName} ${o.clientProfileData.lastName || ''}`.trim() : 'Cliente Indefinido',
            totalValue: o.value,
            status: o.status,
            items: o.items?.map((item: any) => ({
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              sellingPrice: item.sellingPrice
            })) || [],
            shippingValue: shippingTotal,
            deliveryChannel: deliveryChannel
          };
        } catch (err) {
          console.error(`Failed to fetch details for order ${order.orderId}`, err);
          return null;
        }
      })
    );

    const activeDetailed = detailedOrders.filter((o): o is NonNullable<typeof o> => o !== null);
    const fetchedIds = new Set(activeDetailed.map(o => o.orderId));
    
    const remainingCurrent = currentList
      .filter((o: any) => !fetchedIds.has(o.orderId))
      .map((o: any) => ({
        orderId: o.orderId,
        creationDate: o.creationDate,
        clientName: o.clientName || 'Cliente Indefinido',
        totalValue: o.totalValue || o.value,
        status: o.status,
        items: [],
        shippingValue: 0,
        deliveryChannel: 'delivery'
      }));

    const formattedPrev = prevList.map((o: any) => ({
      orderId: o.orderId,
      creationDate: o.creationDate,
      clientName: o.clientName || 'Cliente Indefinido',
      totalValue: o.totalValue || o.value,
      status: o.status,
      items: [],
      shippingValue: 0,
      deliveryChannel: 'delivery'
    }));

    const list = [...activeDetailed, ...remainingCurrent, ...formattedPrev];
    return c.json({ list });
  } catch (error: any) {
    console.error('VTEX Error:', error.response?.data || error.message);
    return c.json({ error: error.response?.data || error.message || 'Failed to fetch VTEX data' }, 500);
  }
});

export default app;
