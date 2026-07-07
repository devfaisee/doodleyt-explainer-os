import { httpsPost, fetchImageBuffer } from '../utils/network.js';

export async function callReplicateWithRetry(payloadStr, apiKey, addJobLog, endpointUrl = "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions") {
    const MAX_RETRIES = 8;
    let retries = MAX_RETRIES;
    while (retries > 0) {
        try {
            const res = await httpsPost(
                endpointUrl,
                {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "Prefer": "wait"
                },
                payloadStr
            );
            const resJson = JSON.parse(res.body.toString());
            
            if (resJson.output) {
                if (Array.isArray(resJson.output) && resJson.output.length > 0) {
                    return resJson.output[0];
                }
                if (typeof resJson.output === 'string') {
                    return resJson.output;
                }
            } else {
                throw new Error("No output returned: " + JSON.stringify(resJson));
            }
        } catch (err) {
            let delayMs;
            const is429 = err.message.includes('429');
            const attempt = MAX_RETRIES - retries + 1;
            
            if (is429) {
                try {
                    const errorStr = err.message.substring(err.message.indexOf('{'));
                    const errObj = JSON.parse(errorStr);
                    if (errObj.retry_after) delayMs = (errObj.retry_after + 1) * 1000;
                    else delayMs = 10000;
                } catch(e) { delayMs = 10000; }
                addJobLog(`⏳ Replicate Rate Limit 429. Pacing requests... waiting ${Math.round(delayMs/1000)}s.`);
            } else {
                // Exponential backoff: 5s, 10s, 15s, 20s, 25s, 30s, 35s, 40s
                delayMs = attempt * 5000;
                addJobLog(`⚠️ Replicate API Error (attempt ${attempt}/${MAX_RETRIES}): Retrying in ${delayMs/1000}s...`);
            }
            
            await new Promise(r => setTimeout(r, delayMs));
            retries--;
            if (retries === 0) {
                addJobLog(`❌ Replicate failed permanently after ${MAX_RETRIES} retries.`);
                throw new Error(`Replicate failed after ${MAX_RETRIES} retries: ${err.message}`);
            }
        }
    }
}

export function extractSpokenText(voiceover) {
    if (!voiceover) return '';
    const matches = [...voiceover.matchAll(/"([^"]+)"/g)];
    if (matches.length > 0) return matches[matches.length - 1][1];
    return voiceover.replace(/^Read\s+[^:]+:\s*/i, '').trim();
}

export function parseVoiceover(voiceover) {
    if (!voiceover) return { prompt: "", text: "" };
    const matches = [...voiceover.matchAll(/"([^"]+)"/g)];
    if (matches.length > 0) {
        const text = matches[matches.length - 1][1];
        const stylePart = voiceover.substring(0, voiceover.indexOf(matches[matches.length - 1][0])).trim();
        const prompt = stylePart.replace(/:\s*$/, '').trim();
        return { prompt: prompt || "", text };
    }
    // No quotes found — treat entire string as spoken text with no direction (TTS will use natural tone)
    return { prompt: "", text: voiceover.replace(/^Read\s+[^:]+:\s*/i, '').trim() };
}

export const MOCK_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAACXBIWXMAAAABAAAAAQBPJcTWAAAAe0lEQVR4nNXOMQ0AAAjAsJHMv2ZEcJBVQYc4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4vwNXCyFoAP6hilguAAAAAElFTkSuQmCC";
