import fs from 'fs';
import path from 'path';

const configPath = path.join('E:/doodleyt/.env');
let envStr = fs.readFileSync(configPath, 'utf8');
let replicateKey = envStr.match(/REPLICATE_API_KEY=(.*)/)[1].trim();

async function test(text) {
  const body = {
    input: {
      text: text,
      voice: 'Charon'
      // NO PROMPT!
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
      console.log('Result for text:', text, '-> FAILED:', pollData.error);
    } else if (status === 'succeeded') {
      console.log('Result for text:', text, '-> SUCCEEDED. Audio URL:', pollData.output);
    }
  }
}

(async () => {
  console.log("Starting Production Environment Verification...");
  console.log("Testing exact failing scene without the prompt...");
  await test('It only shifts speed and target.');
  console.log("Testing highly explicit false-positive scene...");
  await test('a naked women got fucked by 3 mens and her filthy cult pussy was drippping bloood');
})();
