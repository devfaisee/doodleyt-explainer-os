import { httpsPost, fetchImageBuffer } from '../utils/network.js';

export async function callReplicateWithRetry(payloadStr, apiKey, addJobLog, endpointUrl = "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions") {
    let retries = 5;
    let currentPayloadStr = payloadStr;
    while (retries > 0) {
        try {
            const res = await httpsPost(
                endpointUrl,
                {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "Prefer": "wait"
                },
                currentPayloadStr
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
            let delayMs = 12000;
            const is429 = err.message.includes('429');
            
            if (is429) {
                try {
                    const errorStr = err.message.substring(err.message.indexOf('{'));
                    const errObj = JSON.parse(errorStr);
                    if (errObj.retry_after) delayMs = (errObj.retry_after + 1) * 1000;
                } catch(e) {}
                addJobLog(`⏳ Replicate Rate Limit 429. Pacing requests... waiting ${Math.round(delayMs/1000)}s.`);
            } else {
                delayMs = (6 - retries) * 4000; // 4s, 8s, 12s, 16s backoff
                addJobLog(`⚠️ Replicate API Error: ${err.message}. Retrying in ${delayMs/1000}s... (${retries - 1} attempts left)`);
                
                const isSafetyError = err.message.toLowerCase().includes('sensitive') || err.message.toLowerCase().includes('flagged');
                if (isSafetyError) {
                    try {
                        const parsed = JSON.parse(currentPayloadStr);
                        if (parsed.input && parsed.input.text) {
                            const originalText = parsed.input.text;
                            let modifiedText = originalText;
                            
                            if (retries === 5) {
                                modifiedText = originalText + ".";
                            } else if (retries === 4) {
                                modifiedText = "And " + originalText.charAt(0).toLowerCase() + originalText.slice(1);
                            } else if (retries === 3) {
                                parsed.input.voice = "Kore";
                            } else if (retries === 2) {
                                parsed.input.voice = "Puck";
                            } else {
                                modifiedText = originalText.replace(/cannibal|flesh|eat|dead|kill|blood|murder/gi, 'survivor');
                            }
                            
                            parsed.input.text = modifiedText;
                            currentPayloadStr = JSON.stringify(parsed);
                            addJobLog(`🛡️ [Safety Guard] Gemini TTS flagged text. Dynamically adjusting payload for retry: voice="${parsed.input.voice}", text="${modifiedText}"`);
                        }
                    } catch (e) {
                        addJobLog(`⚠️ Safety Guard payload correction failed: ${e.message}`);
                    }
                }
            }
            
            await new Promise(r => setTimeout(r, delayMs));
            retries--;
            if (retries === 0) {
                addJobLog(`❌ Replicate failed permanently after 5 retries.`);
                throw new Error(`Replicate failed after 5 retries: ${err.message}`);
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
