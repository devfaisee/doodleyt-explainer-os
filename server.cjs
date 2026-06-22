const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const PORT = 3000;
const CONFIG_FILE = path.join(__dirname, 'config.json');
const FIXATED_KEY = 'sk-or-v1-' + '8ddf4b104ce98919409c0b7df5fa4c15e7a34ed8325751f1d97d4e8e5b82ba07';

// Helper to read config
function readConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('Error reading config:', e);
    }
    return {
        apiKey: FIXATED_KEY,
        model: 'deepseek/deepseek-v4-flash',
        outputPath: path.join(__dirname, 'output'),
        characters: [
            { name: 'BOB', description: 'Stick figure man, round head, thin body, red baseball cap forward, blue hoodie, black pants, white sneakers, large eyebrows, goofy smile' },
            { name: 'SARA', description: 'Female stick figure, long hair drawn as squiggly lines, pink shirt, blue skirt, glasses, surprised expression' }
        ]
    };
}

// Helper to write config
function writeConfig(config) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error('Error writing config:', e);
        return false;
    }
}

// Ensure output directory exists
function ensureDir(dirPath) {
    try {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        return true;
    } catch (e) {
        console.error('Error creating directory:', e);
        return false;
    }
}

// --- BACKEND ORCHESTRATOR STATE & PIPELINE ---
const LATEST_SCRIPT_FILE = path.join(__dirname, 'latest_script.json');
const BANNED_PRONOUNS = ['he', 'she', 'it', 'they', 'his', 'her', 'their', 'its', 'same', 'similar', 'previous', 'earlier', 'above', 'below', 'again', 'identical', 'character', 'figure'];

function readLatestScript() {
    try {
        if (fs.existsSync(LATEST_SCRIPT_FILE)) {
            const data = fs.readFileSync(LATEST_SCRIPT_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('Error reading latest script:', e);
    }
    return null;
}

function writeLatestScript(script) {
    try {
        fs.writeFileSync(LATEST_SCRIPT_FILE, JSON.stringify(script, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error('Error writing latest script:', e);
        return false;
    }
}

const validatePromptText = (promptText) => {
    if (!promptText) return { isValid: true, words: [] };
    const cleaned = promptText.toLowerCase().replace(/[^a-z0-9'\s-]/g, ' ');
    const tokens = cleaned.split(/\s+/);
    const leaked = BANNED_PRONOUNS.filter(p => tokens.includes(p));
    return {
        isValid: leaked.length === 0,
        words: leaked
    };
};

function buildDefaultStages(type, duration) {
    const list = [{ id: 'design', label: '1. Niche & Custom Character Design', status: 'idle' }];
    const numActs = type === 'short' ? 1 : duration;
    for (let i = 1; i <= numActs; i++) {
        list.push({ id: `act${i}`, label: `${i + 1}. Drafting Act ${i} (Dynamic Scenes)`, status: 'idle' });
    }
    list.push({ id: 'qc', label: `${numActs + 2}. Stateless QC Check & Auto-Sanitation`, status: 'idle' });
    return list;
}

let activeJob = {
    status: 'idle', // 'idle' | 'running' | 'completed' | 'failed'
    logs: [],
    stages: [],
    script: readLatestScript(),
    error: null,
    topicTheme: '',
    videoType: 'long',
    targetDuration: 8
};

function addJobLog(msg) {
    const logLine = `[${new Date().toLocaleTimeString()}] ${msg}`;
    activeJob.logs.push(logLine);
    console.log(logLine);
}

function updateJobStageStatus(stageId, status, labelUpdate = null) {
    activeJob.stages = activeJob.stages.map(s => {
        if (s.id === stageId) {
            const updated = { ...s, status };
            if (labelUpdate) updated.label = labelUpdate;
            return updated;
        }
        return s;
    });
}

function getEffectiveApiKey(providedKey) {
    if (providedKey && providedKey.trim().length > 10) {
        return providedKey.trim();
    }
    const config = readConfig();
    if (config.apiKey && config.apiKey.trim().length > 10) {
        return config.apiKey.trim();
    }
    return FIXATED_KEY;
}

async function callOpenRouter(systemPrompt, userPrompt, apiKey, model) {
    const payload = JSON.stringify({
        model: model || 'deepseek/deepseek-v4-flash',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ]
    });
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Doodle Theory OS'
    };
    try {
        const res = await httpsPost('https://openrouter.ai/api/v1/chat/completions', headers, payload);
        const data = JSON.parse(res.body.toString());
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error(data.error?.message || 'Invalid completions response structure');
        }
        return data.choices[0].message.content;
    } catch (e) {
        throw new Error(`OpenRouter Call Failed: ${e.message}`);
    }
}

function startBackendScriptGeneration(topicTheme, videoType, targetDuration, providedApiKey, providedModel) {
    const apiKey = getEffectiveApiKey(providedApiKey);
    const model = providedModel || 'deepseek/deepseek-v4-flash';
    
    // Set initial job state
    activeJob.status = 'running';
    activeJob.logs = [];
    activeJob.error = null;
    activeJob.topicTheme = topicTheme;
    activeJob.videoType = videoType;
    activeJob.targetDuration = targetDuration;
    activeJob.stages = buildDefaultStages(videoType, targetDuration);
    
    // Run the actual generation asynchronously
    (async () => {
        addJobLog(`⚙️ Booting Dynamic Multistage Pipeline Orchestrator...`);
        addJobLog(`🧠 Target Model: ${model}`);
        addJobLog(`🎬 Mode: ${videoType.toUpperCase()} | Target Length: ${videoType === 'short' ? 'Short (~1 min)' : `${targetDuration} min`} (Scene count determined dynamically by LLM)`);
        
        try {
            // Stage 1: Niche & Custom Character Design
            updateJobStageStatus('design', 'running');
            addJobLog(`⚡ Starting Stage 1: Autonomous Niche & Character Design...`);
            
            const designSystemPrompt = `You are an elite YouTube strategist, visual architect, and character designer for the channel "Doodle Theory".
The channel explains bizarre evolutionary anthropology, behavioral psychology experiments, human biology, cosmic anomalies, and historical mysteries using simple, badly-drawn MS Paint stickman doodles.
Art Style Reference Codes: 18154.jpg, 18153.jpg, 18152.jpg, 18142.jpg, 18146.jpg, 18143.jpg, 18147.jpg, 18151.jpg, 18149.jpg, 18159.jpg.
Visual DNA: Crude hand-drawn MS Paint stickman illustrations. Crisp black outlines, stark white backgrounds, minimal color fills (flat colors only), highly exaggerated comic emotions, and bold text overlays. No smooth shading, no gradients, no 3D elements. Low-quality drawings are part of the humor and branding.`;

            const designUserPrompt = `Autonomously select an extremely specific, bizarre, curiosity-driven niche video topic.
${topicTheme ? `Focus on this theme/keyword: "${topicTheme}". Narrow it down to a highly specific, bizarre sub-niche.` : `Generate an extremely specific, weird niche topic.`}

The topic must fit within our core 10 categories:
1. Evolutionary Anthropology & Ancient Human History
2. Behavioral Psychology & Famous Social Experiments
3. Biological Anomalies & Human Body Mysteries
4. Existential, Cognitive & Scientific Mysteries
5. Archaeological Mysteries & Lost Civilizations
6. Survival Psychology & Extreme Environment Biology
7. Bizarre Historical Events & Mass Hysteria
8. Military & Technological Blunders
9. Existential Space & Cosmic Anomalies
10. Psychology of Beliefs & Secret Societies

VIRAL TITLE LAWS (Strictly Enforced):
- Short & Striking: Length must be 5 to 9 words maximum.
- Curiosity Gap Formula: Withhold the core secret, answer, or resolution.
- Provocative Addressing: Speak directly to the viewer.
- Survival/Primal Shock: Highlight deep ancestral fears.
- Formatting: Use sentence case. Never use ending punctuation (no exclamation/question marks) or clickbait emojis.

CHARACTER DESIGN RULES:
Design 1-3 custom characters needed for this script. For each character, design a Character Card with a detailed physical description as a stickman. Art style: crude stickman outline, solid flat colors, white background.

AI THUMBNAIL PROMPT LAW:
Create a highly visual thumbnail description. The layout must feature:
1. A crude MS Paint stickman doodle on a solid white background showing an extreme emotional charge (e.g., sweating profusely, jaw dropped in shock, eyes wide with horror, screaming in panic).
2. A bold capitalized text overlay of 1-3 words (e.g., "DON'T LOOK", "TOO LATE", "POISON!") in red, black, or blue, which complements the title but does not copy it.
The aspect ratio for the video layout is: ${videoType === 'short' ? '9:16 vertical portrait format' : '16:9 widescreen landscape format'}.

Return strictly a JSON object:
{
  "title": "[Clickable Title]",
  "category": "[Category]",
  "nicheReason": "[Why this specific sub-niche is highly viral]",
  "thumbnail": "[Thumbnail image prompt with 1-3 word text overlay detail]",
  "characters": [
    { "name": "NAME", "description": "Complete physical visual description" }
  ]
}`;

            const designResponse = await callOpenRouter(designSystemPrompt, designUserPrompt, apiKey, model);
            if (activeJob.status === 'idle') return; // Cancelled
            const designJsonMatch = designResponse.match(/\{[\s\S]*\}/);
            if (!designJsonMatch) throw new Error("Stage 1 failed to return JSON.");
            
            const designData = JSON.parse(designJsonMatch[0]);
            let finalScriptData = { title: '', category: '', nicheReason: '', thumbnail: '', characters: [] };
            finalScriptData = { ...finalScriptData, ...designData };
            
            // Save to server config characters
            const config = readConfig();
            config.characters = finalScriptData.characters || [];
            writeConfig(config);
            
            addJobLog(`✓ Title: "${finalScriptData.title}"`);
            addJobLog(`✓ Custom characters designed: ${finalScriptData.characters.map(c => c.name).join(', ')}`);
            updateJobStageStatus('design', 'completed');
            
            const charactersListString = finalScriptData.characters.map(c => `- **${c.name}**: ${c.description}`).join('\n');
            const charactersPromptGuide = `Stateless Prompt Rule (THE GOLDEN RULE):
Image generators have no memory. You must never use character names alone and never use pronouns (he, she, it, they, his, her, their, its, same, previous, earlier, above, below, again, character, figure).
Always start the prompt with: "A crude MS Paint stickman doodle with black outlines and flat colors on a white background. [Describe character physical appearance] is [describe specific action/pose/emotion] [describe scene context/objects]."

Character presets to use:
${charactersListString}`;

            const numActs = videoType === 'short' ? 1 : targetDuration;
            let accumulatedScenes = [];
            
            // Loop through Acts
            for (let j = 1; j <= numActs; j++) {
                if (activeJob.status === 'idle') return; // Cancelled
                const stageId = `act${j}`;
                updateJobStageStatus(stageId, 'running');
                addJobLog(`⚡ Starting Stage ${j + 1}: Drafting Act ${j} of ${numActs} (LLM Dynamic Scene Output)...`);
                
                const lastVoContext = j > 1 ? accumulatedScenes.slice(-3).map(s => s.voiceover).join(' | ') : '';
                
                const actSystemPrompt = `You are the Visual Director, scriptwriter, and retention engineer for "Doodle Theory".
You write scripts in JSON format.
Channel Tone: chaotic, humorous, mildly sarcastic, highly engaging. Feel like a friend with terrible drawing skills explaining something unbelievably interesting. Never sound like a teacher or documentary narrator. Entertain first, inform second.
Art Style DNA: Crude hand-drawn MS Paint stickman illustrations. Crisp black outlines, stark white backgrounds, flat colors, highly exaggerated comic emotions, and bold text overlays. No smooth shading, no gradients, no 3D.
Visual Pacing: Fast-paced scenes of 1-3 seconds. Every few seconds must introduce a fresh visual element (zoom, expression change, arrows, highlight circles, motion lines, or visual joke) to maintain maximum retention.`;

                let actTitleText = `Act ${j}`;
                let actFocusText = '';
                
                if (videoType === 'short') {
                    actTitleText = 'Full Video Hook & Story';
                    actFocusText = 'This is a vertical Short. Keep pacing extremely fast and hook strength at maximum throughout.';
                } else {
                    if (j === 1) {
                        actTitleText = 'Act 1 (Hook & Setup)';
                        actFocusText = 'Focus on introducing the shocking hook and setting up the curiosity loop.';
                    } else if (j === numActs) {
                        actTitleText = `Act ${j} (Resolution & Payoff)`;
                        actFocusText = 'Focus on resolving the twists, delivering the final takeaway, and a funny or thought-provoking ending.';
                    } else {
                        actTitleText = `Act ${j} (Rising Conflict & Progression)`;
                        actFocusText = 'Focus on escalating the narrative, introducing details, and opening sub-loops to keep the viewer watching.';
                    }
                }
                
                const actUserPrompt = `Write ${actTitleText} for the video: "${finalScriptData.title}".
Niche context: ${finalScriptData.nicheReason}
${actFocusText}

Last spoken lines of previous section: "${lastVoContext}"

${charactersPromptGuide}

SCRIPTWRITING & PACING LAWS:
1. Pacing & Timing: Keep each scene duration between 1 to 3 seconds. Spoken voiceover sentences must be short, conversational, and punchy.
2. Aspect Ratio: The layout format is ${videoType === 'short' ? '9:16 vertical portrait format' : '16:9 widescreen landscape format'}. Make sure all visual prompts specify this format (e.g. ${videoType === 'short' ? '"9:16 vertical portrait layout"' : '"16:9 widescreen landscape layout"'}).
3. Dynamic Action Prompts: In the "prompt" field, you must write a unique, detailed description of the scene's action. Follow the Stateless Prompt Rule. Never output the exact same visual prompt for different scenes.
4. Capitalized Text Overlay: Every 3-4 scenes, add a short, high-impact text overlay in the "textOverlay" field. Leave null for other scenes.

Generate as many consecutive scenes as you intelligently decide are needed for this act of the video (aim for approximately 15 to 30 scenes to keep the pacing correct, but you have full creative control over the exact count based on how many scenes are needed to explain the content beautifully without rushing or lagging).

Return strictly a JSON object matching this schema:
{
  "scenes": [
    {
      "duration": [1, 2, or 3],
      "voiceover": "[Exact spoken sentence]",
      "camera": "[Editing/camera zoom/movement]",
      "sfx": "[Sound effect]",
      "prompt": "[Complete, action-specific stateless visual prompt. Follow Stateless Prompt Rule. White background]",
      "textOverlay": "[Text on screen or null]"
    }
  ]
}`;

                const actResponse = await callOpenRouter(actSystemPrompt, actUserPrompt, apiKey, model);
                if (activeJob.status === 'idle') return; // Cancelled
                const actJsonMatch = actResponse.match(/\{[\s\S]*\}/);
                if (!actJsonMatch) throw new Error(`Stage ${j + 1} (Act ${j}) failed to return JSON.`);
                
                const actData = JSON.parse(actJsonMatch[0]);
                accumulatedScenes = [...accumulatedScenes, ...actData.scenes];
                addJobLog(`✓ Act ${j} compiled successfully (${actData.scenes.length} scenes).`);
                updateJobStageStatus(stageId, 'completed', `${j + 1}. Act ${j} Completed (${actData.scenes.length} scenes)`);
            }
            
            // Stage 6: Stateless QC Check & Auto-Sanitation
            updateJobStageStatus('qc', 'running');
            addJobLog(`⚡ Starting final Quality Control & Stateless Guardrail analysis...`);
            
            let qcErrorsCount = 0;
            const formatTimeLocal = (seconds) => {
                const mins = Math.floor(seconds / 60);
                const secs = seconds % 60;
                return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            };
            
            let finalScenes = accumulatedScenes.map((scene, idx) => {
                const check = validatePromptText(scene.prompt);
                const sceneTime = formatTimeLocal(accumulatedScenes.slice(0, idx).reduce((acc, s) => acc + (s.duration || 2), 0));
                
                if (!check.isValid) {
                    qcErrorsCount++;
                    addJobLog(`⚠️ Row ${idx + 1} (${sceneTime}): Banned pronoun leak: [${check.words.join(', ')}]`);
                }
                
                return {
                    ...scene,
                    time: sceneTime,
                    qcErrors: check.words
                };
            });
            
            if (qcErrorsCount > 0) {
                addJobLog(`🔧 Launching Automated Pronoun Correction Routine for ${qcErrorsCount} items...`);
                const charsString = finalScriptData.characters.map(c => `- **${c.name}**: ${c.description}`).join('\n');
                
                for (let idx = 0; idx < finalScenes.length; idx++) {
                    if (activeJob.status === 'idle') return; // Cancelled
                    const scene = finalScenes[idx];
                    if (scene.qcErrors && scene.qcErrors.length > 0) {
                        addJobLog(`Fixing Scene ${idx + 1} (${scene.time})...`);
                        
                        const prompt = `Correct this image prompt for an AI image generator to make it completely stateless.
Rules:
1. Replace character names with their full visual descriptions.
2. Remove all relative reference words (he, she, it, they, his, her, their, its, same, previous, earlier, above, below, again).
3. Keep the art style: crude MS Paint stickman doodle, black outline, white background.

Character Presets:
${charsString}

Input Prompt to fix: "${scene.prompt}"
Return only the corrected prompt text, nothing else.`;

                        try {
                            const correctedText = await callOpenRouter(
                                "You are an AI assistant that corrects image generator prompts to be stateless and pronoun-free. You must strictly avoid pronouns (he, she, it, they, his, her, their, its) and relative references (same, previous, earlier, above, below, again). Specifically, never output the word 'above' or 'below' or 'same' or 'he' or 'his' in your output under any circumstances. Replace them with concrete, absolute descriptions.",
                                prompt,
                                apiKey,
                                model
                            );
                            
                            scene.prompt = correctedText.trim();
                            const checkAgain = validatePromptText(scene.prompt);
                            scene.qcErrors = checkAgain.words;
                            if (checkAgain.isValid) {
                                addJobLog(`✅ Refactored Scene ${idx + 1} successfully.`);
                            } else {
                                addJobLog(`⚠️ Refactored Scene ${idx + 1} still has issues: [${checkAgain.words.join(', ')}]`);
                            }
                        } catch (fixErr) {
                            addJobLog(`❌ Failed to auto-correct Scene ${idx + 1}: ${fixErr.message}`);
                        }
                    }
                }
                
                // Recalculate error count
                qcErrorsCount = finalScenes.filter(s => s.qcErrors && s.qcErrors.length > 0).length;
            }
            
            finalScriptData.scenes = finalScenes;
            finalScriptData.timestamp = Date.now();
            
            writeLatestScript(finalScriptData);
            activeJob.script = finalScriptData;
            
            if (qcErrorsCount === 0) {
                addJobLog(`✅ Pipeline Successful: 0 pronoun errors found. Production blueprint ready.`);
            } else {
                addJobLog(`⚠️ QC Completed: Flagged ${qcErrorsCount} prompts remaining. Run 'Auto-Fix' in the Sandbox to sanitize.`);
            }
            updateJobStageStatus('qc', 'completed');
            activeJob.status = 'completed';
            
        } catch (err) {
            addJobLog(`❌ Pipeline Failed: ${err.message}`);
            activeJob.status = 'failed';
            activeJob.error = err.message;
            activeJob.stages = activeJob.stages.map(s => s.status === 'running' ? { ...s, status: 'failed' } : s);
        }
    })();
}

// Native HTTPS POST request helper
function httpsPost(url, headers, body) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const options = {
            hostname: u.hostname,
            path: u.pathname + u.search,
            method: 'POST',
            headers: {
                ...headers,
                'Content-Length': Buffer.byteLength(body)
            }
        };

        const req = https.request(options, (res) => {
            let data = [];
            res.on('data', (chunk) => data.push(chunk));
            res.on('end', () => {
                const buf = Buffer.concat(data);
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ statusCode: res.statusCode, body: buf, headers: res.headers });
                } else {
                    reject(new Error(`HTTP status ${res.statusCode}: ${buf.toString()}`));
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(body);
        req.end();
    });
}

// Native HTTPS GET request helper
function httpsGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = [];
            res.on('data', (chunk) => data.push(chunk));
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(Buffer.concat(data));
                } else {
                    reject(new Error(`HTTP status ${res.statusCode}`));
                }
            });
        }).on('error', (e) => reject(e));
    });
}

// Generate valid silent PCM WAV buffer
function getSilentWavBuffer(durationSeconds = 2) {
    const sampleRate = 8000;
    const numChannels = 1;
    const bitsPerSample = 8;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = Math.ceil(durationSeconds * byteRate);
    const chunkSize = 36 + dataSize;
    
    const buffer = Buffer.alloc(44 + dataSize);
    
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(chunkSize, 4);
    buffer.write('WAVE', 8);
    
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);
    
    buffer.fill(128, 44);
    return buffer;
}

const MOCK_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAoAAAAFACAIAAADUeu9RAAAAJ0lEQVR42u3BAQEAAACAkP6v7ggAAAAAAAAAAAAAAAAAAAAAgAcMDgAB91rO1gAAAABJRU5ErkJggg==";

const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;

    // API Routes
    if (pathname === '/api/generation-status' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(activeJob));
        return;
    }

    if (pathname === '/api/generate-script' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const params = JSON.parse(body);
                const { topicTheme, videoType, targetDuration, apiKey, model } = params;
                startBackendScriptGeneration(topicTheme, videoType, targetDuration, apiKey, model);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Script generation started' }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    if (pathname === '/api/save-active-script' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                activeJob.script = data.script;
                writeLatestScript(data.script);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    if (pathname === '/api/cancel-generation' && req.method === 'POST') {
        activeJob.status = 'idle';
        activeJob.logs.push(`[${new Date().toLocaleTimeString()}] 🛑 Generation cancelled by user.`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
    }

    if (pathname === '/api/config' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(readConfig()));
        return;
    }

    if (pathname === '/api/config' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const newConfig = JSON.parse(body);
                const currentConfig = readConfig();
                const mergedConfig = { ...currentConfig, ...newConfig };
                writeConfig(mergedConfig);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, config: mergedConfig }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }

    if (pathname === '/api/save' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { filename, content } = data;
                const config = readConfig();
                
                const targetDir = config.outputPath || path.join(__dirname, 'output');
                ensureDir(targetDir);

                const filePath = path.join(targetDir, filename);
                fs.writeFileSync(filePath, typeof content === 'object' ? JSON.stringify(content, null, 2) : content, 'utf8');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, filePath }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }
    if (pathname === '/api/synthesize-assets' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const { scenes, falApiKey, elevenlabsApiKey, outputPath } = data;
                
                const targetDir = outputPath || path.join(__dirname, 'output');
                const imagesDir = path.join(targetDir, 'images');
                const audioDir = path.join(targetDir, 'audio');
                
                ensureDir(targetDir);
                ensureDir(imagesDir);
                ensureDir(audioDir);
                
                console.log(`Starting media synthesis for ${scenes.length} scenes...`);
                
                // Synthesize each scene sequentially
                for (let i = 0; i < scenes.length; i++) {
                    const scene = scenes[i];
                    const indexStr = (i + 1).toString().padStart(3, '0');
                    const imgPath = path.join(imagesDir, `scene_${indexStr}.png`);
                    const audioPath = path.join(audioDir, `scene_${indexStr}.wav`);
                    
                    // 1. Image synthesis (Fal.ai Flux Schnell)
                    if (falApiKey) {
                        try {
                            const payload = JSON.stringify({
                                prompt: scene.prompt,
                                image_size: "16:9",
                                num_inference_steps: 4,
                                sync_mode: true
                            });
                            
                            const res = await httpsPost(
                                "https://fal.run/fal-ai/flux/schnell",
                                {
                                    "Authorization": `Key ${falApiKey}`,
                                    "Content-Type": "application/json"
                                },
                                payload
                            );
                            
                            const resJson = JSON.parse(res.body.toString());
                            if (resJson.images && resJson.images[0]) {
                                const imgBuffer = await httpsGet(resJson.images[0].url);
                                fs.writeFileSync(imgPath, imgBuffer);
                                console.log(`[Fal.ai] Saved scene_${indexStr}.png`);
                            } else {
                                throw new Error("No image URL returned");
                            }
                        } catch (err) {
                            console.error(`Fal.ai failed for scene ${i+1}: ${err.message}. Falling back to mock PNG.`);
                            fs.writeFileSync(imgPath, Buffer.from(MOCK_PNG_BASE64, 'base64'));
                        }
                    } else {
                        // Mock fallback
                        fs.writeFileSync(imgPath, Buffer.from(MOCK_PNG_BASE64, 'base64'));
                    }
                    
                    // 2. Audio Synthesis (ElevenLabs voiceover TTS)
                    if (elevenlabsApiKey && scene.voiceover) {
                        try {
                            const payload = JSON.stringify({
                                text: scene.voiceover,
                                model_id: "eleven_monolingual_v1",
                                voice_settings: { stability: 0.5, similarity_boost: 0.75 }
                            });
                            
                            // Using standard Rachel voice: 21m00Tcm4TlvDq8ikWAM
                            const res = await httpsPost(
                                "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM",
                                {
                                    "xi-api-key": elevenlabsApiKey,
                                    "Content-Type": "application/json"
                                },
                                payload
                            );
                            fs.writeFileSync(audioPath, res.body);
                            console.log(`[Elevenlabs] Saved scene_${indexStr}.wav`);
                        } catch (err) {
                            console.error(`ElevenLabs failed for scene ${i+1}: ${err.message}. Falling back to mock silent WAV.`);
                            const duration = parseFloat(scene.duration) || 2;
                            fs.writeFileSync(audioPath, getSilentWavBuffer(duration));
                        }
                    } else {
                        const duration = parseFloat(scene.duration) || 2;
                        fs.writeFileSync(audioPath, getSilentWavBuffer(duration));
                    }
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true, 
                    imagesDir, 
                    audioDir 
                }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    if (pathname === '/api/assemble-video' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const { scenes, outputPath } = data;
                
                const targetDir = outputPath || path.join(__dirname, 'output');
                const imagesDir = path.join(targetDir, 'images');
                const audioDir = path.join(targetDir, 'audio');
                
                // Ensure ffmpeg is in path
                exec('ffmpeg -version', (err, stdout, stderr) => {
                    if (err) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: "FFmpeg is not installed or not in system PATH. Final compilation requires FFmpeg." }));
                        return;
                    }
                    
                    try {
                        const tempVideoFiles = [];
                        const inputsTxtPath = path.join(targetDir, 'inputs.txt');
                        let inputsTxtContent = '';
                        
                        console.log("Compiling individual scene videos...");
                        
                        // Compile each scene individually using loop image and WAV audio
                        let compilePromises = scenes.map((scene, i) => {
                            return new Promise((resolveScene, rejectScene) => {
                                const indexStr = (i + 1).toString().padStart(3, '0');
                                const imgPath = path.join(imagesDir, `scene_${indexStr}.png`);
                                const audioPath = path.join(audioDir, `scene_${indexStr}.wav`);
                                const tempSceneVideo = path.join(targetDir, `temp_scene_${indexStr}.mp4`);
                                const duration = parseFloat(scene.duration) || 2;
                                
                                // Command: Loop 1 image + WAV -> MP4
                                const cmd = `ffmpeg -y -loop 1 -framerate 25 -i "${imgPath}" -i "${audioPath}" -c:v libx264 -t ${duration} -pix_fmt yuv420p -vf "scale=1280:720" -shortest "${tempSceneVideo}"`;
                                
                                exec(cmd, (sceneErr, sceneStdout, sceneStderr) => {
                                    if (sceneErr) {
                                        console.error(`Error rendering scene ${indexStr}:`, sceneErr);
                                        rejectScene(sceneErr);
                                    } else {
                                        tempVideoFiles.push(tempSceneVideo);
                                        resolveScene();
                                    }
                                });
                            });
                        });
                        
                        Promise.all(compilePromises).then(() => {
                            // Sort temp files to ensure chronological order
                            tempVideoFiles.sort();
                            
                            // Write inputs.txt content for FFmpeg concat demuxer
                            tempVideoFiles.forEach(file => {
                                const escapedPath = file.replace(/\\/g, '/');
                                inputsTxtContent += `file '${escapedPath}'\n`;
                            });
                            fs.writeFileSync(inputsTxtPath, inputsTxtContent, 'utf8');
                            
                            const finalVideoPath = path.join(targetDir, 'final_output.mp4');
                            
                            // Concat copy command
                            const concatCmd = `ffmpeg -y -f concat -safe 0 -i "${inputsTxtPath}" -c copy "${finalVideoPath}"`;
                            
                            exec(concatCmd, (concatErr, concatStdout, concatStderr) => {
                                // Clean up temp scene mp4s and inputs.txt
                                tempVideoFiles.forEach(file => {
                                    try { fs.unlinkSync(file); } catch(e){}
                                });
                                try { fs.unlinkSync(inputsTxtPath); } catch(e){}
                                
                                if (concatErr) {
                                    res.writeHead(500, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({ error: `Concatenation failed: ${concatErr.message}` }));
                                } else {
                                    const stats = fs.statSync(finalVideoPath);
                                    res.writeHead(200, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({ 
                                        success: true, 
                                        filePath: finalVideoPath,
                                        fileSize: stats.size
                                    }));
                                }
                            });
                        }).catch(compileErr => {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: `Scene compilation failed: ${compileErr.message}` }));
                        });
                        
                    } catch (innerErr) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: innerErr.message }));
                    }
                });
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // Serve Frontend
    if (pathname === '/' || pathname === '/index.html') {
        const indexPath = path.join(__dirname, 'dist', 'index.html');
        if (fs.existsSync(indexPath)) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(fs.readFileSync(indexPath));
        } else {
            const rootIndexPath = path.join(__dirname, 'index.html');
            if (fs.existsSync(rootIndexPath)) {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(fs.readFileSync(rootIndexPath));
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('index.html not found. Please build the application first (npm run build).');
            }
        }
        return;
    }

    // Serve static files if they exist (checks dist folder first, then root)
    let filePath = path.join(__dirname, 'dist', pathname);
    if (!(fs.existsSync(filePath) && fs.statSync(filePath).isFile())) {
        filePath = path.join(__dirname, pathname);
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.wav': 'audio/wav',
            '.mp4': 'video/mp4',
        };
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(fs.readFileSync(filePath));
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
});

// Find network IPs
function getNetworkIPs() {
    const interfaces = os.networkInterfaces();
    const addresses = [];
    for (const k in interfaces) {
        for (const k2 in interfaces[k]) {
            const address = interfaces[k][k2];
            if (address.family === 'IPv4' && !address.internal) {
                addresses.push(address.address);
            }
        }
    }
    return addresses;
}

server.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`🚀 Explainer OS v2026 local server is running!`);
    console.log(`👉 Access on this machine: http://localhost:${PORT}`);
    
    const ips = getNetworkIPs();
    if (ips.length > 0) {
        console.log(`👉 Access from any device on your local network:`);
        ips.forEach(ip => {
            console.log(`   http://${ip}:${PORT}`);
        });
    }
    console.log(`==================================================`);
});
