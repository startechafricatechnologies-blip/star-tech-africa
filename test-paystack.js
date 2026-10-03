const https = require('https');

// Replace this value with your Paystack secret key before running locally.
const secretKey = process.env.PAYSTACK_SECRET_KEY || 'replace_with_your_paystack_secret_key';

console.log('🔍 Testing Paystack key...');

const options = {
    hostname: 'api.paystack.co',
    port: 443,
    path: '/transaction/initialize',
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
    }
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            const response = JSON.parse(data);
            console.log('📦 Response:', response);
            if (response.status) {
                console.log('✅ SUCCESS! Your key is VALID!');
                console.log('🎉 Paystack is ready to accept payments!');
            } else {
                console.log('❌ ERROR:', response.message);
                console.log('💡 The key might be incomplete or wrong.');
            }
        } catch (error) {
            console.error('❌ Error:', error.message);
        }
    });
});

req.on('error', (error) => {
    console.error('❌ Request error:', error.message);
});

req.write(JSON.stringify({
    email: 'test@example.com',
    amount: 50000,
    currency: 'KES'
}));
req.end();