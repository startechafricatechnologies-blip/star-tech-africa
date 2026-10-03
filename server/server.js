require('dotenv').config();
const express = require('express');
const cors = require('cors');
const https = require('https');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Paystack API configuration
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY;

// In-memory storage for orders (use database in production)
const orders = {};

// ============ PAYSTACK PAYMENT ROUTES ============

// 1. Get all apps
app.get('/api/apps', (req, res) => {
    const apps = [
        {
            id: 'app1',
            name: 'Productivity Pro',
            description: 'Boost your productivity with this powerful tool',
            price: 500,
            currency: 'KES',
            icon: '🚀',
            category: 'Productivity',
            filename: 'productivity-pro.apk'
        },
        {
            id: 'app2',
            name: 'Finance Tracker',
            description: 'Track your expenses and savings easily',
            price: 350,
            currency: 'KES',
            icon: '💰',
            category: 'Finance',
            filename: 'finance-tracker.apk'
        },
        {
            id: 'app3',
            name: 'Health Monitor',
            description: 'Monitor your health metrics daily',
            price: 750,
            currency: 'KES',
            icon: '❤️',
            category: 'Health',
            filename: 'health-monitor.apk'
        }
    ];
    res.json(apps);
});

// 2. Initialize Paystack Payment
app.post('/api/initialize-payment', async (req, res) => {
    try {
        const { appId, appName, price, customerEmail } = req.body;

        // Validate
        if (!appId || !price || !customerEmail) {
            return res.status(400).json({ 
                error: 'Missing required fields' 
            });
        }

        // Generate download token
        const downloadToken = crypto.randomBytes(32).toString('hex');
        const orderId = 'ORD-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');

        // Store order
        orders[orderId] = {
            orderId,
            appId,
            appName,
            price,
            customerEmail,
            downloadToken,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        console.log(`💰 Initializing Paystack payment for: ${appName} (KES ${price})`);
        console.log(`📧 Email: ${customerEmail}`);
        console.log(`🔑 Order: ${orderId}`);

        // Convert price to cents
        const amountInCents = price * 100;

        // Prepare Paystack request
        const postData = JSON.stringify({
            email: customerEmail,
            amount: amountInCents,
            currency: 'KES',
            callback_url: `${process.env.APP_URL || 'http://localhost:3000'}/verify-payment`,
            metadata: {
                app_id: appId,
                app_name: appName,
                order_id: orderId,
                download_token: downloadToken,
                custom_fields: [
                    {
                        display_name: "App Name",
                        variable_name: "app_name",
                        value: appName
                    },
                    {
                        display_name: "Order ID",
                        variable_name: "order_id",
                        value: orderId
                    }
                ]
            }
        });

        // Make request to Paystack API
        const options = {
            hostname: 'api.paystack.co',
            port: 443,
            path: '/transaction/initialize',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': postData.length
            }
        };

        const paystackRequest = https.request(options, (paystackRes) => {
            let data = '';

            paystackRes.on('data', (chunk) => {
                data += chunk;
            });

            paystackRes.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    console.log('✅ Paystack response:', response.status ? 'Success' : 'Failed');

                    if (response.status) {
                        // Update order with reference
                        orders[orderId].reference = response.data.reference;
                        
                        res.json({ 
                            authorization_url: response.data.authorization_url,
                            reference: response.data.reference,
                            access_code: response.data.access_code
                        });
                    } else {
                        console.error('❌ Paystack error:', response.message);
                        res.status(400).json({ 
                            error: response.message || 'Payment initialization failed' 
                        });
                    }
                } catch (error) {
                    console.error('❌ Error parsing Paystack response:', error);
                    res.status(500).json({ error: 'Failed to process payment' });
                }
            });
        });

        paystackRequest.on('error', (error) => {
            console.error('❌ Paystack request error:', error);
            res.status(500).json({ error: 'Payment service unavailable' });
        });

        paystackRequest.write(postData);
        paystackRequest.end();

    } catch (error) {
        console.error('❌ Payment error:', error);
        res.status(500).json({ 
            error: error.message || 'Payment initialization failed' 
        });
    }
});

// 3. Verify Payment (callback after successful payment)
app.get('/verify-payment', (req, res) => {
    const reference = req.query.reference;
    
    if (!reference) {
        return res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Payment Verification - StarTech Africa</title>
                <style>
                    body { font-family: Arial; text-align: center; padding: 50px; background: #f5f5f5; }
                    .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    h1 { color: #e74c3c; }
                    .btn { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>❌ Missing Reference</h1>
                    <p>No payment reference provided.</p>
                    <a href="/" class="btn">Back to Store</a>
                </div>
            </body>
            </html>
        `);
    }

    // Verify payment with Paystack API
    const options = {
        hostname: 'api.paystack.co',
        port: 443,
        path: `/transaction/verify/${reference}`,
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`
        }
    };

    const paystackRequest = https.request(options, (paystackRes) => {
        let data = '';

        paystackRes.on('data', (chunk) => {
            data += chunk;
        });

        paystackRes.on('end', () => {
            try {
                const response = JSON.parse(data);
                console.log('✅ Payment verification:', response.status);

                if (response.status && response.data.status === 'success') {
                    // Get metadata
                    const metadata = response.data.metadata || {};
                    const orderId = metadata.order_id || 'unknown';
                    const appName = metadata.app_name || 'your app';
                    const downloadToken = metadata.download_token || '';
                    const customerEmail = response.data.customer.email || 'customer';

                    // Mark order as completed
                    if (orders[orderId]) {
                        orders[orderId].status = 'completed';
                        console.log(`✅ Order ${orderId} completed for ${customerEmail}`);
                    }

                    // Generate download link
                    const downloadLink = `${process.env.APP_URL || 'http://localhost:3000'}/api/download/${downloadToken}`;

                    res.send(`
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <title>Payment Successful - StarTech Africa</title>
                            <style>
                                body { font-family: Arial; text-align: center; padding: 50px; background: #f5f5f5; }
                                .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                                h1 { color: #2ecc71; }
                                .btn { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                                .btn:hover { background: #5a67d8; }
                                .details { text-align: left; background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
                                .download-btn { background: #27ae60; }
                                .download-btn:hover { background: #229954; }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <h1>✅ Payment Successful!</h1>
                                <p>Thank you for your purchase from StarTech Africa!</p>
                                <div class="details">
                                    <p><strong>App:</strong> ${appName}</p>
                                    <p><strong>Amount:</strong> KES ${response.data.amount / 100}</p>
                                    <p><strong>Reference:</strong> ${reference}</p>
                                    <p><strong>Email:</strong> ${customerEmail}</p>
                                </div>
                                <p style="color: #666;">Your download link is ready!</p>
                                <a href="${downloadLink}" class="btn download-btn" style="font-size: 1.2rem;">
                                    📲 Download Your App
                                </a>
                                <br><br>
                                <p style="color: #999; font-size: 0.9rem;">This link will expire in 24 hours.</p>
                                <br>
                                <a href="/" class="btn">Browse More Apps</a>
                            </div>
                        </body>
                        </html>
                    `);
                } else {
                    // Payment failed or pending
                    const message = response.data ? response.data.status : 'Payment verification failed';
                    res.send(`
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <title>Payment Status - StarTech Africa</title>
                            <style>
                                body { font-family: Arial; text-align: center; padding: 50px; background: #f5f5f5; }
                                .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                                h1 { color: #f39c12; }
                                .btn { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <h1>⏳ Payment ${message}</h1>
                                <p>Your payment is being processed.</p>
                                <p style="color: #666;">Check your email for confirmation.</p>
                                <a href="/" class="btn">Back to Store</a>
                            </div>
                        </body>
                        </html>
                    `);
                }
            } catch (error) {
                console.error('❌ Error verifying payment:', error);
                res.send(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Error - StarTech Africa</title>
                        <style>
                            body { font-family: Arial; text-align: center; padding: 50px; background: #f5f5f5; }
                            .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                            h1 { color: #e74c3c; }
                            .btn { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>❌ Verification Error</h1>
                            <p>Could not verify your payment. Please contact support.</p>
                            <a href="/" class="btn">Back to Store</a>
                        </div>
                    </body>
                    </html>
                `);
            }
        });
    });

    paystackRequest.on('error', (error) => {
        console.error('❌ Verification request error:', error);
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Error - StarTech Africa</title>
                <style>
                    body { font-family: Arial; text-align: center; padding: 50px; background: #f5f5f5; }
                    .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    h1 { color: #e74c3c; }
                    .btn { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>❌ Service Error</h1>
                    <p>Payment verification service is temporarily unavailable.</p>
                    <a href="/" class="btn">Back to Store</a>
                </div>
            </body>
            </html>
        `);
    });

    paystackRequest.end();
});

// 4. Download endpoint
app.get('/api/download/:token', (req, res) => {
    const { token } = req.params;

    // Find order with this token
    let foundOrder = null;
    let foundApp = null;

    for (const orderId in orders) {
        if (orders[orderId].downloadToken === token && orders[orderId].status === 'completed') {
            foundOrder = orders[orderId];
            break;
        }
    }

    if (!foundOrder) {
        return res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Invalid Download - StarTech Africa</title>
                <style>
                    body { font-family: Arial; text-align: center; padding: 50px; background: #f5f5f5; }
                    .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    h1 { color: #e74c3c; }
                    .btn { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>❌ Invalid Download Link</h1>
                    <p>This download link is invalid or has expired.</p>
                    <a href="/" class="btn">Back to Store</a>
                </div>
            </body>
            </html>
        `);
    }

    // Check if link expired (24 hours)
    const createdAt = new Date(foundOrder.createdAt);
    const now = new Date();
    const hoursDiff = (now - createdAt) / (1000 * 60 * 60);
    
    if (hoursDiff > 24) {
        return res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Expired Download - StarTech Africa</title>
                <style>
                    body { font-family: Arial; text-align: center; padding: 50px; background: #f5f5f5; }
                    .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    h1 { color: #e74c3c; }
                    .btn { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>⏰ Download Link Expired</h1>
                    <p>This download link has expired (24 hours limit).</p>
                    <p style="color: #666;">Please contact support for a new link.</p>
                    <a href="/" class="btn">Back to Store</a>
                </div>
            </body>
            </html>
        `);
    }

    // Find the app file
    const apps = [
        { id: 'app1', filename: 'productivity-pro.apk' },
        { id: 'app2', filename: 'finance-tracker.apk' },
        { id: 'app3', filename: 'health-monitor.apk' }
    ];

    const app = apps.find(a => a.id === foundOrder.appId);
    if (!app) {
        return res.status(404).send('App not found');
    }

    const appPath = path.join(__dirname, '../apps', app.filename);
    
    if (fs.existsSync(appPath)) {
        res.download(appPath, app.filename);
    } else {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>App Not Found - StarTech Africa</title>
                <style>
                    body { font-family: Arial; text-align: center; padding: 50px; background: #f5f5f5; }
                    .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    h1 { color: #e74c3c; }
                    .btn { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>📱 App File Missing</h1>
                    <p>The app file is not available yet.</p>
                    <p style="color: #666;">Please contact support.</p>
                    <a href="/" class="btn">Back to Store</a>
                </div>
            </body>
            </html>
        `);
    }
});

// 5. Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'StarTech Africa is running with Paystack!',
        orders: Object.keys(orders).length,
        timestamp: new Date().toISOString()
    });
});

// ============ START SERVER ============
app.listen(PORT, () => {
    console.log('═'.repeat(50));
    console.log(`⭐ StarTech Africa with Paystack`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`💳 Paystack is ready to accept payments!`);
    console.log(`📱 M-PESA payments supported!`);
    console.log(`📦 Download links are ready!`);
    console.log('═'.repeat(50));
});