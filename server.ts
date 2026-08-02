import { Hono } from 'hono';
import axios from 'axios';

type Bindings = {
  GA4_PROPERTY_ID: string;
  GOOGLE_APPLICATION_CREDENTIALS_JSON: string;
  VTEX_ACCOUNT_NAME: string;
  VTEX_APP_KEY: string;
  VTEX_APP_TOKEN: string;
  VTEX_ENVIRONMENT?: string;
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
          mockData.push({
              date: dateStr,
              sessions: Math.floor(Math.random() * 800) + 400,
              conversions: Math.floor(Math.random() * 40) + 5,
              revenue: Math.floor(Math.random() * 4000) + 500,
          });
      }
      return c.json(mockData);
    }

    const credentials = JSON.parse(credentialsJson);
    const accessToken = await getGoogleAccessToken(credentials.client_email, credentials.private_key);
    const propertyId = getEnv(c, 'GA4_PROPERTY_ID');

    const response = await runGa4Report(accessToken, propertyId!, {
      dateRanges: [
        {
          startDate: startDate || '28daysAgo',
          endDate: clampEndDate(endDate),
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

    const data = response.rows?.map((row: any) => {
      return {
        date: row.dimensionValues?.[0].value,
        sessions: parseInt(row.metricValues?.[0].value || '0', 10),
        conversions: parseInt(row.metricValues?.[1].value || '0', 10),
        revenue: parseFloat(row.metricValues?.[2].value || '0'),
      };
    }) || [];

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

    const credentials = JSON.parse(credentialsJson);
    const accessToken = await getGoogleAccessToken(credentials.client_email, credentials.private_key);
    const propertyId = getEnv(c, 'GA4_PROPERTY_ID');

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
    const { startDate, endDate, category } = await c.req.json();
    
    const missing = checkEnvVars(c, ['VTEX_ACCOUNT_NAME', 'VTEX_APP_KEY', 'VTEX_APP_TOKEN']);
    if (missing.length > 0) {
      console.warn('Missing VTEX credentials. Returning mock data for visualization.');
      
    const mockOrders = Array.from({ length: 50 }).map((_, i) => {
        const itemQuantity = Math.floor(Math.random() * 3) + 1;
        const itemPrice = (Math.floor(Math.random() * 200) + 10) * 100;
        const shippingValue = Math.random() > 0.3 ? (Math.floor(Math.random() * 30) + 10) * 100 : 0;
        const deliveryChannel = Math.random() > 0.3 ? 'delivery' : 'pickup-in-point';
        const totalValue = (itemPrice * itemQuantity) + (deliveryChannel === 'delivery' ? shippingValue : 0);
        return {
          orderId: `v-${1000000000 + Math.floor(Math.random() * 9000000000)}`,
          creationDate: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString(),
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
      
      return c.json({ list: mockOrders });
    }

    const accountName = getEnv(c, 'VTEX_ACCOUNT_NAME');
    const environment = getEnv(c, 'VTEX_ENVIRONMENT') || 'vtexcommercestable';
    
    let fq = '';
    if (startDate && endDate) {
        fq = `creationDate:[${startDate}T00:00:00.000Z TO ${endDate}T23:59:59.999Z]`;
    }

    const response = await axios.get(
      `https://${accountName}.${environment}.com.br/api/oms/pvt/orders`,
      {
        params: {
          f_creationDate: fq ? fq : undefined,
          per_page: 100,
        },
        headers: {
          'X-VTEX-API-AppKey': getEnv(c, 'VTEX_APP_KEY'),
          'X-VTEX-API-AppToken': getEnv(c, 'VTEX_APP_TOKEN'),
          'Accept': 'application/json'
        }
      }
    );

    const ordersList = response.data.list || [];
    
    const detailedOrders = await Promise.all(
      ordersList.map(async (order: any) => {
        try {
          const detailResponse = await axios.get(
            `https://${accountName}.${environment}.com.br/api/oms/pvt/orders/${order.orderId}`,
            {
              headers: {
                'X-VTEX-API-AppKey': getEnv(c, 'VTEX_APP_KEY'),
                'X-VTEX-API-AppToken': getEnv(c, 'VTEX_APP_TOKEN'),
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

    const list = detailedOrders.filter(o => o !== null);
    return c.json({ list });
  } catch (error: any) {
    console.error('VTEX Error:', error.response?.data || error.message);
    return c.json({ error: error.response?.data || error.message || 'Failed to fetch VTEX data' }, 500);
  }
});

// Gemini AI Insights Route
app.post('/api/gemini/insights', async (c) => {
  try {
    const {
      totalSessions,
      totalVtexOrders,
      totalVtexRevenue,
      avgConversionRate,
      avgOrderValue,
      totalItemsRevenue,
      totalItemsQuantity,
      pickupOrdersCount,
      deliveryOrdersCount,
      totalShippingValue,
      avgShippingValue
    } = await c.req.json();

    const apiKey = getEnv(c, 'GEMINI_API_KEY');
    if (!apiKey) {
      return c.json({
        insights: [
          "Para ver insights reais baseados em IA, configure a variável GEMINI_API_KEY no seu painel ou .env.",
          "O Faturamento de Itens está saudável, mas fique de olho no ticket médio para otimizar suas ofertas.",
          "Pedidos de Entrega representam a maior parte. Considere campanhas de frete grátis direcionadas para elevar a conversão."
        ]
      });
    }

    const prompt = `Analise as seguintes métricas de e-commerce e traga exatamente 3 recomendações acionáveis, concisas, diretas e focadas em conversão, fretes, ou comportamento de compra. Comece cada recomendação com uma ação direta. Responda em formato JSON, com um array de strings chamado "insights".
Métricas do Período Atual:
- Visitas/Sessões: ${totalSessions}
- Total Pedidos VTEX: ${totalVtexOrders}
- Faturamento Total (com frete): R$ ${totalVtexRevenue.toFixed(2)}
- Faturamento de Itens: R$ ${totalItemsRevenue.toFixed(2)}
- Taxa de Conversão Média: ${avgConversionRate}%
- Ticket Médio: R$ ${avgOrderValue.toFixed(2)}
- Quantidade total de itens vendidos: ${totalItemsQuantity}
- Pedidos para Retirada (Pickup): ${pickupOrdersCount}
- Pedidos para Entrega (Delivery): ${deliveryOrdersCount}
- Faturamento total de fretes: R$ ${totalShippingValue.toFixed(2)}
- Custo de frete médio por entrega: R$ ${avgShippingValue.toFixed(2)}
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                insights: {
                  type: "ARRAY",
                  items: { type: "STRING" }
                }
              },
              required: ["insights"]
            }
          }
        })
      }
    );

    const data = await response.json() as any;
    if (!response.ok) {
      throw new Error(`Gemini API error: ${JSON.stringify(data)}`);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("No content generated by Gemini");
    }

    return c.json(JSON.parse(text));
  } catch (error: any) {
    console.error('Gemini Error:', error);
    return c.json({
      insights: [
        "Erro ao conectar com o Gemini API: " + error.message,
        "Por favor, verifique se sua API Key do Gemini é válida.",
        "Considere revisar as regras de permissão no painel da Cloudflare."
      ]
    });
  }
});

export default app;
