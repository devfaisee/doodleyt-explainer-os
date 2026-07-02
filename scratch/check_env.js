import process from 'process';

console.log('REPLICATE_API_KEY exists:', !!process.env.REPLICATE_API_KEY);
if (process.env.REPLICATE_API_KEY) {
    console.log('REPLICATE_API_KEY start:', process.env.REPLICATE_API_KEY.substring(0, 5));
}
