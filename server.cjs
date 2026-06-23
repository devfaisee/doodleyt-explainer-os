const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

// Load environment variables from .env file if it exists
try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split(/\r?\n/).forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            const index = trimmed.indexOf('=');
            if (index > 0) {
                const key = trimmed.slice(0, index).trim();
                let value = trimmed.slice(index + 1).trim();
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                process.env[key] = value;
            }
        });
    }
} catch (e) {
    console.error('Error loading .env file:', e);
}

const PORT = 3000;
const CONFIG_FILE = path.join(__dirname, 'config.json');
const FIXATED_KEY = process.env.OPENROUTER_API_KEY || '';
const MAX_BODY = 10 * 1024 * 1024; // 10 MB

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
        visualDNA: "Crude hand-drawn MS Paint stickman illustrations. Crisp black outlines, stark white backgrounds, minimal color fills (flat colors only), highly exaggerated comic emotions, and bold text overlays. No smooth shading, no gradients, no 3D elements. Low-quality drawings are part of the humor and branding.",
        styleReferences: ['18154.jpg', '18153.jpg', '18152.jpg', '18142.jpg', '18146.jpg', '18143.jpg', '18147.jpg', '18151.jpg', '18149.jpg', '18159.jpg'],
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
const SCRIPTS_HISTORY_DIR = path.join(__dirname, 'scripts_history');
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

// --- SCRIPT HISTORY DB ---
function saveScriptToHistory(script) {
    try {
        ensureDir(SCRIPTS_HISTORY_DIR);
        // Use a slugified title + timestamp as filename
        const slug = (script.title || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 60);
        const filename = `${script.timestamp || Date.now()}_${slug}.json`;
        const filePath = path.join(SCRIPTS_HISTORY_DIR, filename);
        fs.writeFileSync(filePath, JSON.stringify(script, null, 2), 'utf8');
        console.log(`[History] Script saved: ${filename}`);
        return filename;
    } catch (e) {
        console.error('Error saving script to history:', e);
        return null;
    }
}

function listScriptHistory() {
    try {
        ensureDir(SCRIPTS_HISTORY_DIR);
        const files = fs.readdirSync(SCRIPTS_HISTORY_DIR)
            .filter(f => f.endsWith('.json'))
            .sort((a, b) => b.localeCompare(a)); // Newest first
        
        return files.map(filename => {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(SCRIPTS_HISTORY_DIR, filename), 'utf8'));
                return {
                    filename,
                    timestamp: data.timestamp,
                    title: data.title || 'Untitled Script',
                    category: data.category || '',
                    videoType: data.videoType || 'long',
                    sceneCount: (data.scenes || []).length,
                    thumbnail: data.thumbnail || '',
                    seoMetadata: data.seoMetadata || null,
                    assetsSynthesized: data.assetsSynthesized || false,
                    videoPath: data.videoPath || '',
                    thumbnailPath: data.thumbnailPath || ''
                };
            } catch (e) {
                return { filename, title: filename, timestamp: 0, sceneCount: 0 };
            }
        });
    } catch (e) {
        console.error('Error listing script history:', e);
        return [];
    }
}

function loadScriptFromHistory(filename) {
    try {
        const filePath = path.join(SCRIPTS_HISTORY_DIR, filename);
        if (!fs.existsSync(filePath)) return null;
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        console.error('Error loading script from history:', e);
        return null;
    }
}

function deleteScriptFromHistory(filename) {
    try {
        const filePath = path.join(SCRIPTS_HISTORY_DIR, filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return true;
    } catch (e) {
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
    activeJob.jobType = 'generation';
    activeJob.logs = [];
    activeJob.error = null;
    activeJob.topicTheme = topicTheme;
    activeJob.videoType = videoType;
    activeJob.targetDuration = targetDuration;
    activeJob.stages = buildDefaultStages(videoType, targetDuration);
    activeJob.script = null; // Clear old script data
    
    // Run the actual generation asynchronously
    (async () => {
        addJobLog(`⚙️ Booting Dynamic Multistage Pipeline Orchestrator...`);
        addJobLog(`🧠 Target Model: ${model}`);
        addJobLog(`🎬 Mode: ${videoType.toUpperCase()} | Target Length: ${videoType === 'short' ? 'Short (~1 min)' : `${targetDuration} min`} (Scene count determined dynamically by LLM)`);
        
        try {
            // Stage 1: Niche & Custom Character Design
            updateJobStageStatus('design', 'running');
            addJobLog(`⚡ Starting Stage 1: Autonomous Niche & Character Design...`);
            
            const config = readConfig();
            const visualDNA = config.visualDNA || "Crude hand-drawn MS Paint stickman illustrations. Crisp black outlines, stark white backgrounds, minimal color fills (flat colors only), highly exaggerated comic emotions, and bold text overlays. No smooth shading, no gradients, no 3D elements. Low-quality drawings are part of the humor and branding.";
            const styleReferences = config.styleReferences || ['18154.jpg', '18153.jpg', '18152.jpg', '18142.jpg', '18146.jpg', '18143.jpg', '18147.jpg', '18151.jpg', '18149.jpg', '18159.jpg'];

            const designSystemPrompt = `You are an elite YouTube strategist, visual architect, and character designer for the channel "Doodle Theory".
The channel explains bizarre evolutionary anthropology, behavioral psychology experiments, human biology, cosmic anomalies, and historical mysteries using simple, badly-drawn MS Paint stickman doodles.
Art Style Reference Codes: ${Array.isArray(styleReferences) ? styleReferences.join(', ') : styleReferences}.
Visual DNA: ${visualDNA}`;

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

SEO METADATA GENERATION (Critical for YouTube Publishing):
Generate platform-perfect SEO data for YouTube:
- description: A 2-3 sentence compelling video description that starts with a hook, includes the topic's main mystery, and ends with a curiosity-building CTA.
- hashtags: Exactly 15 viral hashtags relevant to the topic, category, and channel (include #DoodleTheory always). Format as array of strings with # prefix.
- tags: 25 comma-separated plain tags for YouTube Tags field (no # prefix, mix of broad and specific).

Return strictly a JSON object:
{
  "title": "[Clickable Title]",
  "category": "[Category]",
  "nicheReason": "[Why this specific sub-niche is highly viral]",
  "thumbnail": "[Thumbnail image prompt with 1-3 word text overlay detail]",
  "characters": [
    { "name": "NAME", "description": "Complete physical visual description" }
  ],
  "seoMetadata": {
    "description": "[2-3 sentence hook-driven video description with CTA]",
    "hashtags": ["#DoodleTheory", "#ScienceFacts", "... 13 more"],
    "tags": "doodle theory, animated explainer, science facts, ... 22 more tags"
  }
}`;

            const designResponse = await callOpenRouter(designSystemPrompt, designUserPrompt, apiKey, model);
            if (activeJob.status === 'idle') return; // Cancelled
            // Robust JSON extraction: strip markdown code fences first, then fall back to regex
            let designRaw = designResponse;
            const designFenceMatch = designRaw.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (designFenceMatch) designRaw = designFenceMatch[1].trim();
            const designJsonMatch = designRaw.match(/\{[\s\S]*\}/);
            if (!designJsonMatch) throw new Error("Stage 1 failed to return JSON.");
            
            const designData = JSON.parse(designJsonMatch[0]);
            let finalScriptData = { title: '', category: '', nicheReason: '', thumbnail: '', characters: [] };
            finalScriptData = { ...finalScriptData, ...designData };
            
            // Save to server config characters
            const activeConfig = readConfig();
            activeConfig.characters = finalScriptData.characters || [];
            writeConfig(activeConfig);
            
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
                // Robust JSON extraction: strip markdown code fences first, then fall back to regex
                let actRaw = actResponse;
                const actFenceMatch = actRaw.match(/```(?:json)?\s*([\s\S]*?)```/);
                if (actFenceMatch) actRaw = actFenceMatch[1].trim();
                const actJsonMatch = actRaw.match(/\{[\s\S]*\}/);
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
            finalScriptData.videoType = videoType;
            finalScriptData.targetDuration = targetDuration;
            
            writeLatestScript(finalScriptData);
            // Save permanently to history database
            const savedFilename = saveScriptToHistory(finalScriptData);
            if (savedFilename) finalScriptData.historyFilename = savedFilename;
            activeJob.script = finalScriptData;
            
            if (qcErrorsCount === 0) {
                addJobLog(`✅ Pipeline Successful: 0 pronoun errors found. Production blueprint ready.`);
            } else {
                addJobLog(`⚠️ QC Completed: Flagged ${qcErrorsCount} prompts remaining. Run 'Auto-Fix' in the Sandbox to sanitize.`);
            }
            if (savedFilename) addJobLog(`💾 Script saved to history database: ${savedFilename}`);
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

function startBackendSynthesis(script, falApiKey, elevenlabsApiKey, providedOutputPath) {
    activeJob.status = 'running';
    activeJob.jobType = 'synthesis';
    activeJob.logs = [];
    activeJob.error = null;
    activeJob.script = script;
    activeJob.stages = [];
    
    (async () => {
        addJobLog(`⚡ Starting background asset synthesis for script: "${script.title}"`);
        try {
            const config = readConfig();
            const targetDir = providedOutputPath || config.outputPath || path.join(__dirname, 'output');
            const imagesDir = path.join(targetDir, 'images');
            const audioDir = path.join(targetDir, 'audio');
            const thumbnailsDir = path.join(targetDir, 'thumbnails');
            
            ensureDir(targetDir);
            ensureDir(imagesDir);
            ensureDir(audioDir);
            ensureDir(thumbnailsDir);
            
            const scenes = script.scenes || [];
            addJobLog(`⚙️ Synthesizing media for ${scenes.length} scenes...`);
            
            // 1. Generate Thumbnail Image if prompt exists and Fal.ai key is available
            let thumbnailPath = '';
            if (falApiKey && script.thumbnail) {
                addJobLog(`🎨 Synthesizing custom thumbnail image...`);
                try {
                    const payload = JSON.stringify({
                        prompt: script.thumbnail,
                        image_size: script.videoType === 'short' ? 'portrait_4_3' : 'landscape_16_9',
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
                        const slug = (script.title || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 50);
                        const thumbName = `thumb_${script.timestamp || Date.now()}_${slug}.png`;
                        const fullThumbPath = path.join(thumbnailsDir, thumbName);
                        
                        await fs.promises.writeFile(fullThumbPath, imgBuffer);
                        thumbnailPath = `/output/thumbnails/${thumbName}`;
                        addJobLog(`✓ Custom thumbnail saved: ${thumbnailPath}`);
                    } else {
                        throw new Error("No thumbnail URL returned");
                    }
                } catch (err) {
                    addJobLog(`⚠️ Thumbnail synthesis failed: ${err.message}`);
                }
            }
            
            // 2. Synthesize each scene sequentially
            for (let i = 0; i < scenes.length; i++) {
                if (activeJob.status === 'idle') {
                    addJobLog(`🛑 Synthesis job cancelled by user.`);
                    return;
                }
                
                const scene = scenes[i];
                const indexStr = (i + 1).toString().padStart(3, '0');
                const imgPath = path.join(imagesDir, `scene_${indexStr}.png`);
                const audioPath = path.join(audioDir, `scene_${indexStr}.wav`);
                
                scene.imagePath = `/output/images/scene_${indexStr}.png`;
                scene.audioPath = `/output/audio/scene_${indexStr}.wav`;
                
                // Image synthesis
                if (falApiKey) {
                    try {
                        const payload = JSON.stringify({
                            prompt: scene.prompt,
                            image_size: script.videoType === 'short' ? 'portrait_4_3' : 'landscape_16_9',
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
                            await fs.promises.writeFile(imgPath, imgBuffer);
                            addJobLog(`[Fal.ai] Scene ${i+1}/${scenes.length} image completed.`);
                        } else {
                            throw new Error("No image URL returned");
                        }
                    } catch (err) {
                        addJobLog(`⚠️ Fal.ai failed for scene ${i+1}: ${err.message}. Saving fallback.`);
                        await fs.promises.writeFile(imgPath, Buffer.from(MOCK_PNG_BASE64, 'base64'));
                    }
                } else {
                    await fs.promises.writeFile(imgPath, Buffer.from(MOCK_PNG_BASE64, 'base64'));
                }
                
                // Audio synthesis
                if (elevenlabsApiKey && scene.voiceover) {
                    try {
                        const payload = JSON.stringify({
                            text: scene.voiceover,
                            model_id: "eleven_monolingual_v1",
                            voice_settings: { stability: 0.5, similarity_boost: 0.75 }
                        });
                        
                        const res = await httpsPost(
                            "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM",
                            {
                                "xi-api-key": elevenlabsApiKey,
                                "Content-Type": "application/json"
                            },
                            payload
                        );
                        await fs.promises.writeFile(audioPath, res.body);
                        addJobLog(`[ElevenLabs] Scene ${i+1}/${scenes.length} voiceover completed.`);
                    } catch (err) {
                        addJobLog(`⚠️ ElevenLabs failed for scene ${i+1}: ${err.message}. Saving silent wav.`);
                        const duration = parseFloat(scene.duration) || 2;
                        await fs.promises.writeFile(audioPath, getSilentWavBuffer(duration));
                    }
                } else {
                    const duration = parseFloat(scene.duration) || 2;
                    await fs.promises.writeFile(audioPath, getSilentWavBuffer(duration));
                }
            }
            
            script.assetsSynthesized = true;
            if (thumbnailPath) script.thumbnailPath = thumbnailPath;
            script.timestamp = Date.now();
            
            writeLatestScript(script);
            if (script.historyFilename) {
                const filePath = path.join(SCRIPTS_HISTORY_DIR, script.historyFilename);
                await fs.promises.writeFile(filePath, JSON.stringify(script, null, 2), 'utf8');
            }
            
            activeJob.script = script;
            activeJob.status = 'completed';
            addJobLog(`🎉 Asset synthesis finished successfully!`);
        } catch (e) {
            activeJob.status = 'failed';
            activeJob.error = e.message;
            addJobLog(`❌ Asset synthesis failed: ${e.message}`);
        }
    })();
}

function startBackendAssembly(script, providedOutputPath) {
    activeJob.status = 'running';
    activeJob.jobType = 'assembly';
    activeJob.logs = [];
    activeJob.error = null;
    activeJob.script = script;
    activeJob.stages = [];
    
    (async () => {
        addJobLog(`🎬 Starting background video compilation for: "${script.title}"`);
        
        exec('ffmpeg -version', async (err, stdout, stderr) => {
            if (err) {
                activeJob.status = 'failed';
                activeJob.error = "FFmpeg is not installed or not in system PATH. Final compilation requires FFmpeg.";
                addJobLog(`❌ FFmpeg check failed: FFmpeg is not installed or not in system PATH.`);
                return;
            }
            
            try {
                const config = readConfig();
                const targetDir = providedOutputPath || config.outputPath || path.join(__dirname, 'output');
                const imagesDir = path.join(targetDir, 'images');
                const audioDir = path.join(targetDir, 'audio');
                const videosDir = path.join(targetDir, 'videos');
                
                ensureDir(targetDir);
                ensureDir(imagesDir);
                ensureDir(audioDir);
                ensureDir(videosDir);
                
                const scenes = script.scenes || [];
                const tempVideoFiles = [];
                const inputsTxtPath = path.join(targetDir, 'inputs.txt');
                let inputsTxtContent = '';
                
                addJobLog(`⚙️ Compiling ${scenes.length} individual scene videos...`);
                
                const batchSize = 4;
                for (let i = 0; i < scenes.length; i += batchSize) {
                    if (activeJob.status === 'idle') {
                        addJobLog(`🛑 Compilation cancelled by user.`);
                        return;
                    }
                    
                    const batch = scenes.slice(i, i + batchSize);
                    const batchPromises = batch.map((scene, batchIdx) => {
                        const sceneIndex = i + batchIdx;
                        const indexStr = (sceneIndex + 1).toString().padStart(3, '0');
                        const imgPath = path.join(imagesDir, `scene_${indexStr}.png`);
                        const audioPath = path.join(audioDir, `scene_${indexStr}.wav`);
                        const tempSceneVideo = path.join(targetDir, `temp_scene_${indexStr}.mp4`);
                        const duration = parseFloat(scene.duration) || 2;
                        
                        const cmd = `ffmpeg -y -loop 1 -framerate 25 -i "${imgPath}" -i "${audioPath}" -c:v libx264 -t ${duration} -pix_fmt yuv420p -vf "scale=1280:720" -shortest "${tempSceneVideo}"`;
                        
                        return new Promise((resolveScene, rejectScene) => {
                            exec(cmd, (sceneErr) => {
                                if (sceneErr) {
                                    rejectScene(sceneErr);
                                } else {
                                    tempVideoFiles.push(tempSceneVideo);
                                    resolveScene();
                                }
                            });
                        });
                    });
                    
                    try {
                        await Promise.all(batchPromises);
                        addJobLog(`✓ Compiled scenes ${i + 1} to ${Math.min(i + batchSize, scenes.length)} of ${scenes.length}`);
                    } catch (batchErr) {
                        throw new Error(`Scene compilation failed at batch ${i + 1}: ${batchErr.message}`);
                    }
                }
                
                tempVideoFiles.sort();
                
                tempVideoFiles.forEach(file => {
                    const escapedPath = file.replace(/\\/g, '/');
                    inputsTxtContent += `file '${escapedPath}'\n`;
                });
                await fs.promises.writeFile(inputsTxtPath, inputsTxtContent, 'utf8');
                
                const slug = (script.title || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 50);
                const videoFilename = `video_${script.timestamp || Date.now()}_${slug}.mp4`;
                const finalVideoPath = path.join(videosDir, videoFilename);
                
                addJobLog(`⚡ Concatenating individual scene files into final master print...`);
                const concatCmd = `ffmpeg -y -f concat -safe 0 -i "${inputsTxtPath}" -c copy "${finalVideoPath}"`;
                
                exec(concatCmd, async (concatErr) => {
                    tempVideoFiles.forEach(file => {
                        try { fs.unlinkSync(file); } catch(e){}
                    });
                    try { fs.unlinkSync(inputsTxtPath); } catch(e){}
                    
                    if (concatErr) {
                        activeJob.status = 'failed';
                        activeJob.error = `Concatenation failed: ${concatErr.message}`;
                        addJobLog(`❌ Concatenation failed: ${concatErr.message}`);
                    } else {
                        const stats = fs.statSync(finalVideoPath);
                        
                        script.videoPath = `/output/videos/${videoFilename}`;
                        script.timestamp = Date.now();
                        
                        writeLatestScript(script);
                        if (script.historyFilename) {
                            const filePath = path.join(SCRIPTS_HISTORY_DIR, script.historyFilename);
                            await fs.promises.writeFile(filePath, JSON.stringify(script, null, 2), 'utf8');
                        }
                        
                        activeJob.script = script;
                        activeJob.status = 'completed';
                        addJobLog(`🎉 Master video compilation finished successfully!`);
                        addJobLog(`💾 File saved: ${script.videoPath} (${stats.size} bytes)`);
                    }
                });
                
            } catch (innerErr) {
                activeJob.status = 'failed';
                activeJob.error = innerErr.message;
                addJobLog(`❌ Compilation failed: ${innerErr.message}`);
            }
        });
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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
        // Concurrent generation guard
        if (activeJob.status === 'running') {
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'A generation job is already in progress.' }));
            return;
        }
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > MAX_BODY) {
                req.destroy();
                res.writeHead(413, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Request body too large.' }));
            }
        });
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
        req.on('data', chunk => {
            body += chunk;
            if (body.length > MAX_BODY) {
                req.destroy();
                res.writeHead(413, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Request body too large.' }));
            }
        });
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

    if (pathname === '/api/scripts-history' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ scripts: listScriptHistory() }));
        return;
    }

    if (pathname === '/api/load-script' && req.method === 'GET') {
        const filename = parsedUrl.searchParams.get('filename');
        if (!filename) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'filename query parameter is required' }));
            return;
        }
        // Security: prevent path traversal
        const safeFilename = path.basename(filename);
        const script = loadScriptFromHistory(safeFilename);
        if (!script) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Script not found in history' }));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ script }));
        return;
    }

    if (pathname === '/api/delete-script' && req.method === 'DELETE') {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > MAX_BODY) {
                req.destroy();
                res.writeHead(413, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Request body too large.' }));
            }
        });
        req.on('end', () => {
            try {
                const { filename } = JSON.parse(body);
                const safeFilename = path.basename(filename);
                const deleted = deleteScriptFromHistory(safeFilename);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: deleted }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    if (pathname === '/api/update-script-history' && req.method === 'POST') {
        // Updates an existing history entry (e.g. after sandbox edits)
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > MAX_BODY) {
                req.destroy();
                res.writeHead(413, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Request body too large.' }));
            }
        });
        req.on('end', () => {
            try {
                const { filename, script } = JSON.parse(body);
                if (!filename || !script) throw new Error('filename and script are required');
                const safeFilename = path.basename(filename);
                const filePath = path.join(SCRIPTS_HISTORY_DIR, safeFilename);
                if (!fs.existsSync(filePath)) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Script not found in history' }));
                    return;
                }
                fs.writeFileSync(filePath, JSON.stringify(script, null, 2), 'utf8');
                writeLatestScript(script);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    if (pathname === '/api/config' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(readConfig()));
        return;
    }

    if (pathname === '/api/config' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > MAX_BODY) {
                req.destroy();
                res.writeHead(413, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Request body too large.' }));
            }
        });
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
        req.on('data', chunk => {
            body += chunk;
            if (body.length > MAX_BODY) {
                req.destroy();
                res.writeHead(413, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Request body too large.' }));
            }
        });
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
        if (activeJob.status === 'running') {
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'A background job is already in progress.' }));
            return;
        }
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > MAX_BODY) {
                req.destroy();
                res.writeHead(413, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Request body too large.' }));
            }
        });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { script, falApiKey, elevenlabsApiKey, outputPath } = data;
                if (!script) throw new Error("Script data is required");
                
                startBackendSynthesis(script, falApiKey, elevenlabsApiKey, outputPath);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Asset synthesis started' }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    if (pathname === '/api/assemble-video' && req.method === 'POST') {
        if (activeJob.status === 'running') {
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'A background job is already in progress.' }));
            return;
        }
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > MAX_BODY) {
                req.destroy();
                res.writeHead(413, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Request body too large.' }));
            }
        });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { script, outputPath } = data;
                if (!script) throw new Error("Script data is required");
                
                startBackendAssembly(script, outputPath);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Video compilation started' }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    if (pathname === '/api/brainstorm-topics' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > MAX_BODY) {
                req.destroy();
                res.writeHead(413, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Request body too large.' }));
            }
        });
        req.on('end', async () => {
            try {
                const { apiKey: providedApiKey, model: providedModel } = JSON.parse(body);
                const apiKey = getEffectiveApiKey(providedApiKey);
                const model = providedModel || 'deepseek/deepseek-v4-flash';
                
                const systemPrompt = "You are a professional YouTube strategist and niche brainstorming expert.";
                const userPrompt = `Generate exactly 10 fresh, high-click, curiosity-driven viral video topics for the YouTube channel 'Doodle Theory'.
The channel focuses strictly on these 10 core categories, and you must generate exactly one topic per category:
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

VIRAL TITLE LAWS:
- Short & Striking: 5 to 9 words max.
- Curiosity Gap Formula: Withhold the core secret.
- Speak directly to the viewer.
- Sentence case. No clickbait emojis or ending punctuation.

For each category, return the brainstormed topic metadata.
Format your response strictly as a JSON object:
{
  "topics": [
    { "id": 1, "title": "[Title 1]", "cat": "[Category 1]", "curiosity": 9.8, "novelty": 9.5, "relatability": 9.2, "hook": "[1 sentence hook]" },
    ...
  ]
}`;
                
                const response = await callOpenRouter(systemPrompt, userPrompt, apiKey, model);
                
                let raw = response;
                const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
                if (fenceMatch) raw = fenceMatch[1].trim();
                const jsonMatch = raw.match(/\{[\s\S]*\}/);
                if (!jsonMatch) throw new Error("Brainstorm failed to return JSON.");
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(jsonMatch[0]);
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    if (pathname === '/api/fix-prompt' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > MAX_BODY) {
                req.destroy();
                res.writeHead(413, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Request body too large.' }));
            }
        });
        req.on('end', async () => {
            try {
                const { prompt, characters: providedChars, apiKey: providedApiKey, model: providedModel } = JSON.parse(body);
                const apiKey = getEffectiveApiKey(providedApiKey);
                const model = providedModel || 'deepseek/deepseek-v4-flash';
                
                const charsString = (providedChars || []).map(c => `- **${c.name}**: ${c.description}`).join('\n');
                const systemPrompt = "You are an AI assistant that corrects image generator prompts to be stateless and pronoun-free. You must strictly avoid pronouns (he, she, it, they, his, her, their, its) and relative references (same, previous, earlier, above, below, again). Specifically, never output the word 'above' or 'below' or 'same' or 'he' or 'his' in your output under any circumstances. Replace them with concrete, absolute descriptions.";
                const userPrompt = `Correct this image prompt for an AI image generator to make it completely stateless.
Rules:
1. Replace character names with their full visual descriptions.
2. Remove all relative reference words (he, she, it, they, his, her, their, its, same, previous, earlier, above, below, again).
3. Keep the art style: crude MS Paint stickman doodle, black outline, white background.

Character Presets:
${charsString}

Input Prompt to fix: "${prompt}"
Return only the corrected prompt text, nothing else.`;
                
                const correctedText = await callOpenRouter(systemPrompt, userPrompt, apiKey, model);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ correctedText: correctedText.trim() }));
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

    // Block sensitive files from being served statically
    const sensitiveFiles = ['config.json', 'latest_script.json', 'package.json', 'package-lock.json'];
    const requestedBasename = path.basename(pathname);
    if (sensitiveFiles.includes(requestedBasename)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden' }));
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
