import { httpsPost } from '../utils/network.js';
import { activeJob } from './job.service.js';

/**
 * Attempts several repair strategies to recover valid JSON from a broken LLM response.
 * Handles: unquoted values, trailing commas, markdown fences, partial prefixes.
 */
export function repairJson(raw) {
    if (!raw || typeof raw !== 'string') return null;

    let text = raw.trim();

    // 1. Strip markdown code fences
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) text = fenceMatch[1].trim();

    // 2. Extract first {...} block
    const braceMatch = text.match(/\{[\s\S]*\}/);
    if (!braceMatch) return null;
    text = braceMatch[0];

    // 3. Try direct parse first
    try { return JSON.parse(text); } catch (_) {}

    // 4. Attempt auto-repair strategies in order
    const repairs = [
        // Remove trailing commas before } or ]
        t => t.replace(/,\s*([\]}])/g, '$1'),
        // Replace unquoted values: "key": word -> "key": "word"  (not numbers/bool/null)
        t => t.replace(/:\s*([A-Za-z][A-Za-z0-9 _\-'\.]*?)(\s*[,\}\]])/g, (m, v, end) => {
            const trimmed = v.trim();
            if (['true','false','null'].includes(trimmed)) return m;
            return `: "${trimmed}"${end}`;
        }),
        // Remove trailing commas again after above repair
        t => t.replace(/,\s*([\]}])/g, '$1'),
        // Fix single-quoted strings
        t => t.replace(/'([^'\\]*)'/g, '"$1"'),
        // Collapse control characters inside strings
        t => t.replace(/[\u0000-\u001F\u007F]/g, ' '),
    ];

    let repaired = text;
    for (const repair of repairs) {
        repaired = repair(repaired);
        try { return JSON.parse(repaired); } catch (_) {}
    }

    // 5. Apply all repairs cumulatively then try once more
    repaired = text;
    for (const repair of repairs) repaired = repair(repaired);
    try { return JSON.parse(repaired); } catch (_) {}

    return null;
}

export async function callOpenRouter(systemPrompt, userPrompt, apiKey, model, isJson = false, maxRetries = 2) {
    const finalApiKey = process.env.OPENROUTER_API_KEY || apiKey;
    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ];
    const payload = JSON.stringify({
        model: model || 'deepseek/deepseek-v4-flash',
        messages,
        response_format: isJson ? { type: 'json_object' } : undefined
    });
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${finalApiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Doodle Theory OS'
    };

    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const res = await httpsPost('https://openrouter.ai/api/v1/chat/completions', headers, payload, 300000);
            const data = JSON.parse(res.body.toString());
            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                throw new Error(data.error?.message || 'Invalid completions response structure');
            }
            if (activeJob && activeJob.status === 'running' && data.usage) {
                activeJob.llmTokens = activeJob.llmTokens || { input: 0, output: 0 };
                activeJob.llmTokens.input += data.usage.prompt_tokens || 0;
                activeJob.llmTokens.output += data.usage.completion_tokens || 0;
            }
            let textResponse = data.choices[0].message.content;
            // Strip <final_answer> tags if present
            const finalAnswerMatch = textResponse.match(/<final_answer>([\s\S]*?)<\/final_answer>/);
            if (finalAnswerMatch) textResponse = finalAnswerMatch[1];
            return textResponse;
        } catch (e) {
            lastError = e;
            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
            }
        }
    }
    throw new Error(`OpenRouter Call Failed: ${lastError.message}`);
}

export async function callGeminiAPI(systemInstruction, userPrompt, apiKey, modelName = 'gemini-2.5-flash', isJson = true) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const payload = JSON.stringify({
        contents: [{
            parts: [{ text: userPrompt }]
        }],
        systemInstruction: systemInstruction ? {
            parts: [{ text: systemInstruction }]
        } : undefined,
        generationConfig: isJson ? {
            responseMimeType: "application/json"
        } : undefined
    });
    const headers = { 'Content-Type': 'application/json' };
    try {
        const res = await httpsPost(url, headers, payload, 300000);
        const data = JSON.parse(res.body.toString());
        if (data.error) throw new Error(data.error.message || 'Gemini error');
        if (!data.candidates?.[0]?.content?.parts?.[0]) {
            throw new Error('Invalid Gemini API response structure');
        }
        return data.candidates[0].content.parts[0].text;
    } catch (e) {
        throw new Error(`Google Gemini Call Failed: ${e.message}`);
    }
}
