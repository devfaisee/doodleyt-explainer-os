import { httpsPost } from '../utils/network.js';
import { activeJob } from './job.service.js';

export async function callOpenRouter(systemPrompt, userPrompt, apiKey, model, isJson = false) {
    const finalApiKey = process.env.OPENROUTER_API_KEY || apiKey;
    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ];
    if (isJson) {
        messages.push({ role: "assistant", content: "{\n  \"title\":" });
    }
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
        const match = textResponse.match(/<final_answer>([\s\S]*?)<\/final_answer>/);
        if (match) {
            textResponse = match[1];
        }
        if (isJson && !textResponse.startsWith("{")) {
            textResponse = "{\n  \"title\":" + textResponse;
        }
        return textResponse;
    } catch (e) {
        throw new Error(`OpenRouter Call Failed: ${e.message}`);
    }
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
    const headers = {
        'Content-Type': 'application/json'
    };
    try {
        const res = await httpsPost(url, headers, payload, 300000);
        const data = JSON.parse(res.body.toString());
        if (data.error) {
            throw new Error(data.error.message || 'Gemini error');
        }
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
            throw new Error('Invalid Gemini API response structure');
        }
        return data.candidates[0].content.parts[0].text;
    } catch (e) {
        throw new Error(`Google Gemini Call Failed: ${e.message}`);
    }
}
