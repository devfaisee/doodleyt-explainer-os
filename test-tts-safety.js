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
  
  // Poll
  let status = data.status;
  let url = `https://api.replicate.com/v1/predictions/${data.id}`;
  while (status !== 'succeeded' && status !== 'failed' && status !== 'canceled') {
    await new Promise(r => setTimeout(r, 1000));
    const pollRes = await fetch(url, { headers: { 'Authorization': `Bearer ${replicateKey}` } });
    const pollData = await pollRes.json();
    status = pollData.status;
    if (status === 'failed') {
      console.log('Result for text:', text, '-> FAILED:', pollData.error);
    } else if (status === 'succeeded') {
      console.log('Result for text:', text, '-> SUCCEEDED');
    }
  }
}

const p1 = 'A highly professional, calm, and grounded documentary narrator. Completely consistent natural speaking volume. NO dramatic overacting, NO whispering, NO shouting. Steady conversational pacing, objective tone, and stable speech dynamics.';
const p2 = 'A documentary narrator.';

(async () => {
  console.log("TEST 1: Original text, Original prompt");
  await test('You can feel a hand that', p1);
  console.log("\nTEST 2: Safe text, Original prompt");
  await test('The human brain is mysterious.', p1);
  console.log("\nTEST 3: Original text, Simple prompt");
  await test('You can feel a hand that', p2);
  console.log("\nTEST 4: Original text, NO prompt");
  await test('You can feel a hand that', undefined);
})();
