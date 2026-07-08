import fs from 'fs';
import path from 'path';

const configPath = path.join('E:/doodleyt/.env');
let envStr = fs.readFileSync(configPath, 'utf8');
let replicateKey = envStr.match(/REPLICATE_API_KEY=(.*)/)[1].trim();

async function test(text, promptStr) {
  const body = {
    input: {
      text: text,
      voice: 'Charon',
      prompt: promptStr
    }
  };
  
  const res = await fetch('https://api.replicate.com/v1/models/google/gemini-3.1-flash-tts/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${replicateKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  
  const data = await res.json();
  if (data.error) {
     console.log('Result for text:', text, '-> ERROR:', data.error);
     return;
  }
  
  let status = data.status;
  let url = `https://api.replicate.com/v1/predictions/${data.id}`;
  while (status !== 'succeeded' && status !== 'failed' && status !== 'canceled') {
    await new Promise(r => setTimeout(r, 1000));
    const pollRes = await fetch(url, { headers: { 'Authorization': `Bearer ${replicateKey}` } });
    const pollData = await pollRes.json();
    status = pollData.status;
    if (status === 'failed') {
      console.log('Result for text:', text, '| prompt:', promptStr, '-> FAILED:', pollData.error);
    } else if (status === 'succeeded') {
      console.log('Result for text:', text, '| prompt:', promptStr, '-> SUCCEEDED');
    }
  }
}

const p1 = 'A professional, calm, and grounded documentary narrator. Consistent natural speaking volume, steady conversational pacing, objective tone, and stable speech dynamics.';
const p2 = 'A narrator.';

(async () => {
  console.log("TEST 1: Target text, Current prompt");
  await test('It only shifts speed and target.', p1);
  console.log("\nTEST 2: Target text, Simple prompt");
  await test('It only shifts speed and target.', p2);
  console.log("\nTEST 3: Target text, NO prompt");
  await test('It only shifts speed and target.', undefined);
  console.log("\nTEST 4: Another text, NO prompt");
  await test('The bullet hit the wall.', undefined);
})();
