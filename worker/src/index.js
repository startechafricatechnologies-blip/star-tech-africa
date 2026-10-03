const APP_CATALOG = [
  {
    id: 'app1',
    name: 'Productivity Pro',
    description: 'Boost your productivity with this powerful tool',
    price: 500,
    currency: 'KES',
    icon: '🚀',
    category: 'Productivity',
    filename: 'productivity-pro.apk',
    storage_path: 'apps/productivity-pro.apk',
    active: true
  },
  {
    id: 'app2',
    name: 'Finance Tracker',
    description: 'Track your expenses and savings easily',
    price: 350,
    currency: 'KES',
    icon: '💰',
    category: 'Finance',
    filename: 'finance-tracker.apk',
    storage_path: 'apps/finance-tracker.apk',
    active: true
  },
  {
    id: 'app3',
    name: 'Health Monitor',
    description: 'Monitor your health metrics daily',
    price: 750,
    currency: 'KES',
    icon: '❤️',
    category: 'Health',
    filename: 'health-monitor.apk',
    storage_path: 'apps/health-monitor.apk',
    active: true
  }
];

const memoryOrders = new Map();

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization'
    }
  });
}

function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

function makeRandomToken(byteLength = 16) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function getBaseUrl(requestOrUrl, env) {
  if (env.APP_URL) {
    return env.APP_URL;
  }

  const url = typeof requestOrUrl === 'string' ? new URL(requestOrUrl) : new URL(requestOrUrl.url);
  return `${url.protocol}//${url.host}`;
}

function getStorageUrl(env, storagePath) {
  if (!storagePath) {
    return null;
  }

  if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
    const normalizedPath = String(storagePath).replace(/^\/+/, '');
    return `${env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/apps/${encodeURIComponent(normalizedPath)}`;
  }

  return null;
}

async function getAppsFromSupabase(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return APP_CATALOG;
  }

  try {
    const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/apps?select=*`, {
      method: 'GET',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return APP_CATALOG;
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      return APP_CATALOG;
    }

    return data
      .filter((app) => app.active !== false)
      .map((app) => ({
        id: app.id,
        name: app.name,
        description: app.description,
        price: Number(app.price),
        currency: app.currency || 'KES',
        icon: app.icon,
        category: app.category,
        filename: app.filename,
        storage_path: app.storage_path,
        active: app.active
      }));
  } catch (error) {
    console.error('Supabase apps fetch failed:', error);
    return APP_CATALOG;
  }
}

async function persistOrder(env, orderRecord) {
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/orders`, {
        method: 'POST',
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify(orderRecord)
      });

      if (!response.ok) {
        console.error('Supabase order insert failed:', await response.text());
      }
    } catch (error) {
      console.error('Supabase order write error:', error);
    }
  }

  memoryOrders.set(orderRecord.order_id, orderRecord);
}

async function findOrderByToken(env, token) {
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/orders?download_token=eq.${encodeURIComponent(token)}&select=*`, {
        method: 'GET',
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          return data[0];
        }
      }
    } catch (error) {
      console.error('Failed to read order from Supabase:', error);
    }
  }

  for (const order of memoryOrders.values()) {
    if (order.download_token === token) {
      return order;
    }
  }

  return null;
}

async function updateOrderByReference(env, reference, updates) {
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/orders?paystack_reference=eq.${encodeURIComponent(reference)}`, {
        method: 'PATCH',
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          return data[0];
        }
      } else {
        console.error('Supabase order update failed:', await response.text());
      }
    } catch (error) {
      console.error('Supabase order update error:', error);
    }
  }

  for (const order of memoryOrders.values()) {
    if (order.paystack_reference === reference) {
      Object.assign(order, updates);
      return order;
    }
  }

  return null;
}

async function initializePaystackPayment(env, body) {
  if (!env.PAYSTACK_SECRET_KEY) {
    return { error: 'Paystack secret key is not configured.' };
  }

  const postData = JSON.stringify({
    email: body.customerEmail,
    amount: Number(body.price) * 100,
    currency: 'KES',
    callback_url: `${getBaseUrl(env.APP_URL || 'https://example.com', env)}/api/verify-payment`,
    metadata: {
      app_id: body.appId,
      app_name: body.appName,
      order_id: body.orderId,
      download_token: body.downloadToken,
      custom_fields: [
        { display_name: 'App Name', variable_name: 'app_name', value: body.appName },
        { display_name: 'Order ID', variable_name: 'order_id', value: body.orderId }
      ]
    }
  });

  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
      'Content-Length': String(new TextEncoder().encode(postData).length)
    },
    body: postData
  });

  const data = await response.json();

  if (!response.ok || !data.status) {
    return {
      error: data.message || 'Payment initialization failed.'
    };
  }

  return {
    authorization_url: data.data.authorization_url,
    reference: data.data.reference,
    access_code: data.data.access_code
  };
}

async function verifyPaystackTransaction(env, reference) {
  if (!env.PAYSTACK_SECRET_KEY) {
    return { error: 'Paystack secret key is not configured.' };
  }

  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok || !data.status) {
    return { status: 'failed', error: data.message || 'Payment verification failed.' };
  }

  return {
    status: data.data.status,
    data: data.data
  };
}

function renderPaymentStatePage(title, heading, message, buttonText = 'Back to Store', buttonLink = '/', accent = '#667eea') {
  return `<!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
          .container { max-width: 520px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: ${accent}; }
          .btn { display: inline-block; padding: 12px 30px; background: ${accent}; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .btn:hover { opacity: 0.95; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>${heading}</h1>
          <p>${message}</p>
          <a href="${buttonLink}" class="btn">${buttonText}</a>
        </div>
      </body>
    </html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization'
        }
      });
    }

    if (url.pathname === '/api/health') {
      return jsonResponse({
        status: 'OK',
        message: 'StarTech Africa Worker is running with Paystack!',
        orders: memoryOrders.size,
        timestamp: new Date().toISOString()
      });
    }

    if (url.pathname === '/api/apps' && request.method === 'GET') {
      const apps = await getAppsFromSupabase(env);
      return jsonResponse(apps);
    }

    if (url.pathname === '/api/initialize-payment' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { appId, appName, price, customerEmail } = body || {};

        if (!appId || !price || !customerEmail) {
          return jsonResponse({ error: 'Missing required fields' }, 400);
        }

        const orderId = `ORD-${Date.now()}-${makeRandomToken(8)}`;
        const downloadToken = makeRandomToken(32);
        const orderRecord = {
          order_id: orderId,
          app_id: appId,
          app_name: appName,
          price: Number(price),
          currency: 'KES',
          customer_email: customerEmail,
          download_token: downloadToken,
          paystack_reference: null,
          status: 'pending',
          created_at: new Date().toISOString(),
          completed_at: null,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };

        await persistOrder(env, orderRecord);

        const paymentResponse = await initializePaystackPayment(env, {
          ...body,
          orderId,
          downloadToken
        });

        if (paymentResponse.error) {
          return jsonResponse({ error: paymentResponse.error }, 400);
        }

        await updateOrderByReference(env, paymentResponse.reference, {
          paystack_reference: paymentResponse.reference
        });

        return jsonResponse({
          authorization_url: paymentResponse.authorization_url,
          reference: paymentResponse.reference,
          access_code: paymentResponse.access_code
        });
      } catch (error) {
        console.error('Payment initialization failed:', error);
        return jsonResponse({ error: 'Payment initialization failed.' }, 500);
      }
    }

    if (url.pathname === '/api/verify-payment' && request.method === 'GET') {
      const reference = url.searchParams.get('reference');
      if (!reference) {
        return htmlResponse(renderPaymentStatePage('Payment Verification - StarTech Africa', '❌ Missing Reference', 'No payment reference provided.', 'Back to Store', '/', '#e74c3c'));
      }

      try {
        const verified = await verifyPaystackTransaction(env, reference);

        if (verified.status !== 'success') {
          const message = verified.data ? verified.data.status : 'Payment verification failed';
          return htmlResponse(renderPaymentStatePage('Payment Status - StarTech Africa', `⏳ Payment ${message}`, 'Your payment is being processed. Check your email for confirmation.', 'Back to Store', '/', '#f39c12'));
        }

        const metadata = verified.data.metadata || {};
        const orderId = metadata.order_id || 'unknown';
        const appName = metadata.app_name || 'your app';
        const downloadToken = metadata.download_token || '';
        const customerEmail = verified.data.customer?.email || 'customer';

        if (orderId !== 'unknown') {
          await updateOrderByReference(env, reference, {
            status: 'completed',
            paystack_reference: reference,
            completed_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          });
        }

        const baseUrl = getBaseUrl(request.url, env);
        const downloadLink = `${baseUrl}/api/download/${downloadToken}`;

        return htmlResponse(`<!DOCTYPE html>
          <html>
            <head>
              <title>Payment Successful - StarTech Africa</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
                .container { max-width: 520px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                h1 { color: #2ecc71; }
                .btn { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                .details { text-align: left; background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
                .download-btn { background: #27ae60; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>✅ Payment Successful!</h1>
                <p>Thank you for your purchase from StarTech Africa!</p>
                <div class="details">
                  <p><strong>App:</strong> ${appName}</p>
                  <p><strong>Amount:</strong> KES ${Number(verified.data.amount) / 100}</p>
                  <p><strong>Reference:</strong> ${reference}</p>
                  <p><strong>Email:</strong> ${customerEmail}</p>
                </div>
                <p style="color: #666;">Your download link is ready!</p>
                <a href="${downloadLink}" class="btn download-btn" style="font-size: 1.2rem;">📲 Download Your App</a>
                <br><br>
                <p style="color: #999; font-size: 0.9rem;">This link will expire in 24 hours.</p>
                <br>
                <a href="/" class="btn">Browse More Apps</a>
              </div>
            </body>
          </html>`);
      } catch (error) {
        console.error('Payment verification error:', error);
        return htmlResponse(renderPaymentStatePage('Error - StarTech Africa', '❌ Verification Error', 'Could not verify your payment. Please contact support.', 'Back to Store', '/', '#e74c3c'));
      }
    }

    if (url.pathname.startsWith('/api/download/')) {
      const token = url.pathname.split('/').pop();
      if (!token) {
        return htmlResponse(renderPaymentStatePage('Invalid Download - StarTech Africa', '❌ Invalid Download Link', 'This download link is invalid or has expired.', 'Back to Store', '/', '#e74c3c'));
      }

      const foundOrder = await findOrderByToken(env, token);
      if (!foundOrder || foundOrder.status !== 'completed') {
        return htmlResponse(renderPaymentStatePage('Invalid Download - StarTech Africa', '❌ Invalid Download Link', 'This download link is invalid or has expired.', 'Back to Store', '/', '#e74c3c'));
      }

      const createdAt = new Date(foundOrder.created_at || foundOrder.createdAt || Date.now());
      const now = new Date();
      const hoursDiff = (now - createdAt) / (1000 * 60 * 60);

      if (hoursDiff > 24) {
        return htmlResponse(renderPaymentStatePage('Expired Download - StarTech Africa', '⏰ Download Link Expired', 'This download link has expired (24 hours limit). Please contact support for a new link.', 'Back to Store', '/', '#e74c3c'));
      }

      const app = APP_CATALOG.find((item) => item.id === foundOrder.app_id) || null;
      if (!app) {
        return htmlResponse('App not found', 404);
      }

      const storageUrl = getStorageUrl(env, app.storage_path || app.filename);
      if (storageUrl) {
        return Response.redirect(storageUrl, 302);
      }

      return htmlResponse(renderPaymentStatePage('App Not Found - StarTech Africa', '📱 App File Missing', 'The app file is not available yet. Please contact support.', 'Back to Store', '/', '#e74c3c'));
    }

    return new Response('Not found', { status: 404 });
  }
};
