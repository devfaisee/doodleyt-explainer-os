import { httpsPost, fetchImageBuffer } from '../utils/network.js';

export async function callReplicateWithRetry(payloadStr, apiKey, addJobLog, endpointUrl = "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions") {
    let retries = 5;
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
                throw new Error("No image URL returned: " + JSON.stringify(resJson));
            }
        } catch (err) {
            if (err.message.includes('429')) {
                let delayMs = 12000;
                try {
                    const errorStr = err.message.substring(err.message.indexOf('{'));
                    const errObj = JSON.parse(errorStr);
                    if (errObj.retry_after) delayMs = (errObj.retry_after + 1) * 1000;
                } catch(e) {}
                addJobLog(`⏳ Replicate Rate Limit 429. Pacing requests... waiting ${Math.round(delayMs/1000)}s.`);
                await new Promise(r => setTimeout(r, delayMs));
                retries--;
                if (retries === 0) throw new Error(`Replicate failed after 5 retries: ${err.message}`);
            } else {
                throw err;
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
    if (!voiceover) return { prompt: "Say the following in a clear, professional tone.", text: "" };
    const matches = [...voiceover.matchAll(/"([^"]+)"/g)];
    if (matches.length > 0) {
        const text = matches[matches.length - 1][1];
        const stylePart = voiceover.substring(0, voiceover.indexOf(matches[matches.length - 1][0])).trim();
        const prompt = stylePart.replace(/:\s*$/, '').trim();
        return { prompt: prompt || "Say the following.", text };
    }
    return { prompt: "Say the following.", text: voiceover.replace(/^Read\s+[^:]+:\s*/i, '').trim() };
}

export const MOCK_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAACXBIWXMAAAABAAAAAQBPJcTWAAAAe0lEQVR4nNXOMQ0AAAjAsJHMv2ZEcJBVQYc4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4vwNXCyFoAP6hilguAAAAAElFTkSuQmCC";
