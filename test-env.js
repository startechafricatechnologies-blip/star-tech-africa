require('dotenv').config();

console.log('PORT:', process.env.PORT);
console.log('APP_URL:', process.env.APP_URL);
console.log('PAYSTACK_SECRET_KEY:', process.env.PAYSTACK_SECRET_KEY);
console.log('PAYSTACK_PUBLIC_KEY:', process.env.PAYSTACK_PUBLIC_KEY);

if (process.env.PAYSTACK_SECRET_KEY) {
    console.log('✅ .env is loading correctly!');
    console.log('Key starts with:', process.env.PAYSTACK_SECRET_KEY.substring(0, 10) + '...');
} else {
    console.log('❌ .env is NOT loading!');
    console.log('💡 Make sure:');
    console.log('   1. .env file exists in the root folder');
    console.log('   2. It has PAYSTACK_SECRET_KEY=sk_test_...');
    console.log('   3. No spaces around the = sign');
}