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

// Add ffmpeg to PATH dynamically using ffmpeg-static
try {
    const ffmpegPath = require('ffmpeg-static');
    if (ffmpegPath) {
        process.env.PATH = path.dirname(ffmpegPath) + path.delimiter + process.env.PATH;
        console.log('[System] Dynamically prepended ffmpeg-static to process.env.PATH');
    }
} catch (e) {
    console.error('Failed to load ffmpeg-static:', e);
}

const PORT = process.env.PORT || 3000;
const CONFIG_FILE = path.join(__dirname, 'config.json');
const FIXATED_KEY = process.env.OPENROUTER_API_KEY || '';
const MAX_BODY = 10 * 1024 * 1024; // 10 MB

// Generates a human-readable audio filename: first 2 words of title + padded scene index
// e.g. title="Why Dinosaurs Don't Exist", index=0 → "why-dinosaurs-voiceover-01.mp3"
function getAudioFileName(title, sceneIndex) {
    const words = (title || 'audio scene')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 0)
        .slice(0, 2);
    const prefix = words.length > 0 ? words.join('-') : 'audio';
    const padded = String(sceneIndex + 1).padStart(2, '0');
    return `${prefix}-voiceover-${padded}.mp3`;
}

// Converts a WAV buffer to an MP3 file at destPath using FFmpeg.
// Writes a temp WAV first, converts, then removes the temp.
function saveAudioAsMP3(wavBuffer, destPath) {
    return new Promise((resolve, reject) => {
        const tempWav = destPath.replace(/\.mp3$/, '_tmp.wav');
        fs.writeFile(tempWav, wavBuffer, (writeErr) => {
            if (writeErr) return reject(writeErr);
            const cmd = `ffmpeg -nostdin -y -i "${tempWav}" -codec:a libmp3lame -qscale:a 2 "${destPath}"`;
            exec(cmd, (ffErr) => {
                try { fs.unlinkSync(tempWav); } catch (_) {}
                if (ffErr) return reject(new Error(`FFmpeg MP3 conversion failed: ${ffErr.message}`));
                resolve();
            });
        });
    });
}

// --- POSTGRESQL DATABASE FOR PERMANENT MEMORY ---
let pgPool = null;
if (process.env.DATABASE_URL) {
    try {
        const pg = require('pg');
        pgPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
        console.log('[Database] Connecting to PostgreSQL database...');
        
        // Initialize table
        pgPool.query(`
            CREATE TABLE IF NOT EXISTS scripts_history (
                filename VARCHAR(255) PRIMARY KEY,
                timestamp BIGINT,
                title TEXT,
                category VARCHAR(255),
                video_type VARCHAR(50),
                scene_count INT,
                thumbnail TEXT,
                seo_metadata JSONB,
                assets_synthesized BOOLEAN,
                video_path TEXT,
                thumbnail_path TEXT,
                full_script JSONB
            );
        `).then(() => {
            console.log('[Database] PostgreSQL table scripts_history is ready.');
        }).catch(err => {
            console.error('[Database] Failed to create table scripts_history:', err);
        });
    } catch (e) {
        console.error('[Database] Failed to initialize pg Pool:', e);
    }
}

function mapRowToScriptSummary(row) {
    return {
        filename: row.filename,
        timestamp: parseInt(row.timestamp, 10),
        title: row.title || 'Untitled Script',
        category: row.category || '',
        videoType: row.video_type || 'long',
        sceneCount: parseInt(row.scene_count, 10) || 0,
        thumbnail: row.thumbnail || '',
        seoMetadata: row.seo_metadata || null,
        assetsSynthesized: row.assets_synthesized || false,
        videoPath: row.video_path || '',
        thumbnailPath: row.thumbnail_path || ''
    };
}

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
        visualDNA: "Minimalist hand-drawn 2D vector-style cartoon illustration (similar to YouTube channel Zenn). Clean, smooth, non-jagged black felt-pen outlines and solid flat color fills. Exaggerated comical cartoon expressions (wide cartoon eyes, sweating, gaping mouth). Backgrounds are high-contrast and completely flat: solid white, bright solid yellow, deep solid black, or simple flat colored environments (no gradients, no realistic shading, no 3D rendering). Features bold, hand-drawn uppercase text overlays with thick black outlines (typically in bright yellow, red, or white) and clean, hand-drawn red pointing arrows or white speech bubbles where appropriate. Simple, clean, cute cartoon representations of characters, animals, and objects instead of complex or messy sketches. Perfect clean outlines (no messy or pixelated lines, no scribbled draft lines).",
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
const LATEST_SCRIPT_FILE = path.join(__dirname, 'output', 'latest_script.json');
const SCRIPTS_HISTORY_DIR = path.join(__dirname, 'output', 'scripts_history');
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
async function saveScriptToHistory(script) {
    try {
        // Use a slugified title + timestamp as filename
        const slug = (script.title || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 60);
        const filename = `${script.timestamp || Date.now()}_${slug}.json`;

        if (pgPool) {
            await pgPool.query(`
                INSERT INTO scripts_history (
                    filename, timestamp, title, category, video_type, scene_count, 
                    thumbnail, seo_metadata, assets_synthesized, video_path, thumbnail_path, full_script
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                ON CONFLICT (filename) DO UPDATE SET
                    timestamp = EXCLUDED.timestamp,
                    title = EXCLUDED.title,
                    category = EXCLUDED.category,
                    video_type = EXCLUDED.video_type,
                    scene_count = EXCLUDED.scene_count,
                    thumbnail = EXCLUDED.thumbnail,
                    seo_metadata = EXCLUDED.seo_metadata,
                    assets_synthesized = EXCLUDED.assets_synthesized,
                    video_path = EXCLUDED.video_path,
                    thumbnail_path = EXCLUDED.thumbnail_path,
                    full_script = EXCLUDED.full_script
            `, [
                filename,
                script.timestamp || Date.now(),
                script.title || 'Untitled Script',
                script.category || '',
                script.videoType || 'long',
                (script.scenes || []).length,
                script.thumbnail || '',
                script.seoMetadata ? JSON.stringify(script.seoMetadata) : null,
                script.assetsSynthesized || false,
                script.videoPath || '',
                script.thumbnailPath || '',
                JSON.stringify(script)
            ]);
            console.log(`[History] Script saved to PostgreSQL: ${filename}`);
        }

        // Also write locally as fallback/cache/local dev compatibility
        try {
            ensureDir(SCRIPTS_HISTORY_DIR);
            const filePath = path.join(SCRIPTS_HISTORY_DIR, filename);
            fs.writeFileSync(filePath, JSON.stringify(script, null, 2), 'utf8');
            console.log(`[History] Script saved locally: ${filename}`);
        } catch (localErr) {
            console.error('Error writing history file locally:', localErr);
        }

        return filename;
    } catch (e) {
        console.error('Error saving script to history:', e);
        return null;
    }
}

async function listScriptHistory() {
    try {
        if (pgPool) {
            const res = await pgPool.query(`
                SELECT filename, timestamp, title, category, video_type, scene_count, 
                       thumbnail, seo_metadata, assets_synthesized, video_path, thumbnail_path, full_script 
                FROM scripts_history 
                ORDER BY timestamp DESC
            `);
            return res.rows.map(row => {
                const summary = mapRowToScriptSummary(row);
                // Extract estimatedCost from full_script JSON blob
                try {
                    const full = typeof row.full_script === 'string' ? JSON.parse(row.full_script) : row.full_script;
                    if (full && full.estimatedCost) summary.estimatedCost = full.estimatedCost;
                } catch(e) {}
                return summary;
            });
        }
    } catch (e) {
        console.error('[History] Failed to list scripts from PostgreSQL database, falling back to files:', e);
    }

    // Fallback to local files
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
                    thumbnailPath: data.thumbnailPath || '',
                    estimatedCost: data.estimatedCost || null
                };
            } catch (e) {
                return { filename, title: filename, timestamp: 0, sceneCount: 0 };
            }
        });
    } catch (e) {
        console.error('Error listing script history from files:', e);
        return [];
    }
}

async function loadScriptFromHistory(filename) {
    try {
        if (pgPool) {
            const res = await pgPool.query('SELECT full_script FROM scripts_history WHERE filename = $1', [filename]);
            if (res.rowCount > 0) {
                const fullScript = res.rows[0].full_script;
                return typeof fullScript === 'string' ? JSON.parse(fullScript) : fullScript;
            }
        }
    } catch (e) {
        console.error(`[History] Failed to load script ${filename} from PostgreSQL, falling back to file:`, e);
    }

    // Fallback to file
    try {
        const filePath = path.join(SCRIPTS_HISTORY_DIR, filename);
        if (!fs.existsSync(filePath)) return null;
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        console.error('Error loading script from history file:', e);
        return null;
    }
}

async function deleteScriptFromHistory(filename) {
    let deletedDb = false;
    let deletedLocal = false;

    try {
        if (pgPool) {
            const res = await pgPool.query('DELETE FROM scripts_history WHERE filename = $1', [filename]);
            deletedDb = res.rowCount > 0;
            console.log(`[History] Deleted from database: ${filename} (success: ${deletedDb})`);
        }
    } catch (e) {
        console.error('[History] Failed to delete script from PostgreSQL:', e);
    }

    try {
        const filePath = path.join(SCRIPTS_HISTORY_DIR, filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            deletedLocal = true;
            console.log(`[History] Deleted local file: ${filename}`);
        }
    } catch (e) {
        console.error('[History] Failed to delete script history file:', e);
    }

    return deletedDb || deletedLocal;
}

async function updateScriptInHistory(filename, script) {
    try {
        let exists = false;
        if (pgPool) {
            const checkRes = await pgPool.query('SELECT filename FROM scripts_history WHERE filename = $1', [filename]);
            if (checkRes.rowCount > 0) {
                exists = true;
            }
        }
        const filePath = path.join(SCRIPTS_HISTORY_DIR, filename);
        if (fs.existsSync(filePath)) {
            exists = true;
        }

        if (!exists) {
            return false;
        }

        if (pgPool) {
            await pgPool.query(`
                INSERT INTO scripts_history (
                    filename, timestamp, title, category, video_type, scene_count, 
                    thumbnail, seo_metadata, assets_synthesized, video_path, thumbnail_path, full_script
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                ON CONFLICT (filename) DO UPDATE SET
                    timestamp = EXCLUDED.timestamp,
                    title = EXCLUDED.title,
                    category = EXCLUDED.category,
                    video_type = EXCLUDED.video_type,
                    scene_count = EXCLUDED.scene_count,
                    thumbnail = EXCLUDED.thumbnail,
                    seo_metadata = EXCLUDED.seo_metadata,
                    assets_synthesized = EXCLUDED.assets_synthesized,
                    video_path = EXCLUDED.video_path,
                    thumbnail_path = EXCLUDED.thumbnail_path,
                    full_script = EXCLUDED.full_script
            `, [
                filename,
                script.timestamp || Date.now(),
                script.title || 'Untitled Script',
                script.category || '',
                script.videoType || 'long',
                (script.scenes || []).length,
                script.thumbnail || '',
                script.seoMetadata ? JSON.stringify(script.seoMetadata) : null,
                script.assetsSynthesized || false,
                script.videoPath || '',
                script.thumbnailPath || '',
                JSON.stringify(script)
            ]);
            console.log(`[History] Database entry updated/upserted: ${filename}`);
        }
        
        // Also update local file
        try {
            ensureDir(SCRIPTS_HISTORY_DIR);
            fs.writeFileSync(filePath, JSON.stringify(script, null, 2), 'utf8');
            console.log(`[History] Local file updated: ${filename}`);
        } catch (localErr) {
            console.error('Error writing local file on update:', localErr);
        }
        return true;
    } catch (e) {
        console.error('Error updating script in history:', e);
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

async function callOpenRouter(systemPrompt, userPrompt, apiKey, model, isJson = false) {
    apiKey = process.env.OPENROUTER_API_KEY || apiKey;
    const payload = JSON.stringify({
        model: model || 'deepseek/deepseek-v4-flash',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        response_format: isJson ? { type: 'json_object' } : undefined
    });
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Doodle Theory OS'
    };
    try {
        // LLM inference can take 3-5 min for large Act outputs — use 5 min timeout
        const res = await httpsPost('https://openrouter.ai/api/v1/chat/completions', headers, payload, 300000);
        const data = JSON.parse(res.body.toString());
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error(data.error?.message || 'Invalid completions response structure');
        }
        return data.choices[0].message.content;
    } catch (e) {
        throw new Error(`OpenRouter Call Failed: ${e.message}`);
    }
}

function extractSpokenText(voiceover) {
    if (!voiceover) return '';
    const match = voiceover.match(/"([^"]+)"/);
    if (match) {
        return match[1];
    }
    return voiceover.replace(/^Read\s+[^:]+:\s*/i, '');
}

function pcmToWav(pcmBuffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16) {
    const buffer = Buffer.alloc(44 + pcmBuffer.length);
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + pcmBuffer.length, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE((sampleRate * numChannels * bitsPerSample) / 8, 28);
    buffer.writeUInt16LE((numChannels * bitsPerSample) / 8, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(pcmBuffer.length, 40);
    pcmBuffer.copy(buffer, 44);
    return buffer;
}

async function callOpenRouterAudio(textPrompt, apiKey, voice = 'alloy') {
    apiKey = process.env.OPENROUTER_API_KEY || apiKey;
    const payload = JSON.stringify({
        model: 'openai/gpt-audio-mini',
        modalities: ['text', 'audio'],
        audio: {
            voice: voice,
            format: 'pcm16'
        },
        stream: true,
        messages: [
            { role: 'system', content: 'You are a raw TTS engine. You MUST output ONLY the exact text provided by the user. Do not add any filler words, do not acknowledge the request, do not elaborate. Just read the text verbatim.' },
            { role: 'user', content: `TEXT TO READ VERBATIM: ${textPrompt}` }
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
        const text = res.body.toString();
        
        const lines = text.split('\n');
        let base64Chunks = [];
        
        for (let line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
                const jsonStr = trimmed.slice(6).trim();
                if (jsonStr === '[DONE]') continue;
                try {
                    const chunk = JSON.parse(jsonStr);
                    if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta) {
                        const delta = chunk.choices[0].delta;
                        if (delta.audio && delta.audio.data) {
                            base64Chunks.push(delta.audio.data);
                        }
                    }
                } catch (jsonErr) {}
            }
        }
        
        if (base64Chunks.length === 0) {
            throw new Error('No audio data found in OpenRouter stream response. Response body was: ' + text.substring(0, 500));
        }
        
        const fullBase64 = base64Chunks.join('');
        const rawPcm = Buffer.from(fullBase64, 'base64');
        return pcmToWav(rawPcm, 24000, 1, 16);
    } catch (e) {
        throw new Error(`OpenRouter Audio TTS Call Failed: ${e.message}`);
    }
}

async function callReplicateWithRetry(payloadStr, apiKey, addJobLog, endpointUrl = "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions") {
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
            
            // Replicate sometimes returns audio outputs as a string (URI) or array.
            if (resJson.output) {
                // If the output is an array (like images often are), return the first item
                if (Array.isArray(resJson.output) && resJson.output.length > 0) {
                    return resJson.output[0];
                }
                // If it's a direct string (like audio URIs often are), return it
                if (typeof resJson.output === 'string') {
                    return resJson.output;
                }
            } else {
                throw new Error("No image URL returned: " + JSON.stringify(resJson));
            }
        } catch (err) {
            if (err.message.includes('429')) {
                let delayMs = 12000; // Default 12 seconds
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

async function callGeminiAPI(systemInstruction, userPrompt, apiKey, modelName = 'gemini-2.5-flash', isJson = true) {
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
        // LLM inference can be slow for large prompts — use 5 min timeout
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
            const config = readConfig();
            const geminiKey = config.geminiApiKey;
            const useGemini = false; // Always use OpenRouter (DeepSeek V4) for text tasks
            const geminiModelName = (model && model.includes('pro')) ? 'gemini-2.5-pro' : 'gemini-2.5-flash';

            addJobLog(`⚙️ Booting Dynamic Multistage Pipeline Orchestrator...`);
            if (useGemini) {
                addJobLog(`🤖 Routing script writing to Google Gemini API (${geminiModelName})`);
            } else {
                addJobLog(`🧠 Routing script writing to OpenRouter (${model})`);
            }
            addJobLog(`🎬 Mode: ${videoType.toUpperCase()} | Target Length: ${videoType === 'short' ? 'Short (~1 min)' : `${targetDuration} min`} (Scene count determined dynamically by LLM)`);
            
            try {
                // Stage 1: Niche & Custom Character Design
                updateJobStageStatus('design', 'running');
                addJobLog(`⚡ Starting Stage 1: Autonomous Niche & Character Design...`);
                
                const visualDNA = config.visualDNA || "Minimalist hand-drawn 2D vector-style cartoon illustration (similar to YouTube channel Zenn). Clean, smooth, non-jagged black felt-pen outlines and solid flat color fills. Exaggerated comical cartoon expressions (wide cartoon eyes, sweating, gaping mouth). Backgrounds are high-contrast and completely flat: solid white, bright solid yellow, deep solid black, or simple flat colored environments (no gradients, no realistic shading, no 3D rendering). Features bold, hand-drawn uppercase text overlays with thick black outlines (typically in bright yellow, red, or white) and clean, hand-drawn red pointing arrows or white speech bubbles where appropriate. Simple, clean, cute cartoon representations of characters, animals, and objects instead of complex or messy sketches. Perfect clean outlines (no messy or pixelated lines, no scribbled draft lines).";
                const styleReferences = config.styleReferences || ['18154.jpg', '18153.jpg', '18152.jpg', '18142.jpg', '18146.jpg', '18143.jpg', '18147.jpg', '18151.jpg', '18149.jpg', '18159.jpg'];
    
            const designSystemPrompt = `You are an elite YouTube strategist, visual architect, and master storyteller for the channel "Doodle Theory".
The channel explains bizarre evolutionary anthropology, behavioral psychology experiments, human biology, cosmic anomalies, and historical mysteries using clean, hand-drawn 2D vector-style cartoon illustrations.
Your narratives are profound, gripping, existential, and cinematic. You do not use cheap humor; you captivate through deep curiosity and mesmerizing storytelling.
Art Style Reference Codes: ${Array.isArray(styleReferences) ? styleReferences.join(', ') : styleReferences}.
Visual DNA: ${visualDNA}`;

            const designUserPrompt = `Autonomously select an extremely specific, bizarre, curiosity-driven niche video topic.
${topicTheme ? `Focus on this theme/keyword: "${topicTheme}". Narrow it down to a highly specific, profound sub-niche.` : `Generate an extremely specific, deeply profound and weird niche topic.`}

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
- Provocative Addressing: Speak directly to the viewer (e.g., "Why Your Brain Fights Sleep at 3 AM").
- Existential/Primal Shock: Highlight deep ancestral fears or reality-breaking facts.
- Formatting: Use sentence case. Never use ending punctuation or clickbait emojis.
    
    CHARACTER DESIGN RULES:
    Design 1-3 custom characters needed for this script. For each character, design a Character Card with a detailed physical description as a cartoon character. Art style: clean hand-drawn 2D cartoon outlines, solid flat colors, white background.
    
    AI THUMBNAIL PROMPT LAW:
    Create a highly visual thumbnail description. The layout must feature:
    1. A clean, hand-drawn 2D cartoon illustration showing an extreme emotional charge (e.g., sweating profusely, jaw dropped in shock, eyes wide with horror, screaming in panic) on a solid white background, with smooth outlines and flat color fills.
    2. A bold capitalized text overlay of 1-3 words (e.g., "DON'T LOOK", "TOO LATE", "POISON!") in red, black, or blue, which complements the title but does not copy it.
    3. The aspect ratio for the video layout is: ${videoType === 'short' ? '9:16 vertical portrait format' : '16:9 widescreen landscape format'}.
    
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
    
                let designResponse;
                if (useGemini) {
                    addJobLog(`🧠 Routing Stage 1 Niche Design through Google Gemini API...`);
                    designResponse = await callGeminiAPI(designSystemPrompt, designUserPrompt, geminiKey, geminiModelName, true);
                } else {
                    addJobLog(`🧠 Routing Stage 1 Niche Design through OpenRouter...`);
                    designResponse = await callOpenRouter(designSystemPrompt, designUserPrompt, apiKey, model, true);
                }
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
Always start the prompt with: "A clean, hand-drawn 2D vector-style cartoon illustration with smooth black felt-pen outlines and flat color fills. [Describe character physical appearance] is [describe specific action/pose/emotion] [describe scene context/objects]. Solid flat white background."

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
                
                const actSystemPrompt = `You are the master storyteller, scriptwriter, and visual director for "Doodle Theory".
You write scripts in JSON format.
Channel Tone: Mesmerizing, cinematic, deeply existential, and profound. The narrator speaks with quiet authority, taking the viewer on a gripping psychological or scientific journey. No chaotic humor, no sarcasm—just pure, captivating fascination (think Vsauce, LEMMiNO, or Aperture).
Narrative Arc: Start with a deeply relatable, grounded premise ("Look at your hand", "Tonight, you'll flip a switch"), then immediately pull the rug out with an existential shock ("But you can't prove any of it is real", "For 99.9% of history, that switch didn't exist"). Build the story step-by-step using short, punchy sentences.
Art Style DNA: Crude whiteboard cartoon illustration style. Hand-drawn felt-pen black outlines, flat solid color fills. Backgrounds are simple and high-contrast: solid white, bright solid yellow, deep solid black, or flat colored environments. Features bold, hand-drawn uppercase text overlays with thick black outlines (typically in bright yellow, red, or white) and simple hand-drawn red pointing arrows or white speech bubbles where appropriate. Simple, cute cartoon representations of animals, people, and objects instead of complex artwork. No gradients, no 3D elements, no realistic shading.
Visual Pacing: The visuals MUST perfectly sync with the spoken words. Every single frame must exactly depict what the narrator is talking about in that exact moment.`;

                let actTitleText = `Act ${j}`;
                let actFocusText = '';
                
                if (videoType === 'short') {
                    actTitleText = 'Full Video Hook & Story (Psychological Short Framework)';
                    actFocusText = `This is a vertical Short. You MUST strictly follow this psychological pacing:
1. 0:00-0:03 (The Pattern Interrupt): A highly relatable, grounded hook paired with a jarring concept.
2. 0:03-0:15 (The Existential Rug-Pull): Subvert the premise immediately.
3. 0:15-0:45 (The Escalating Descent): High information density. Rapid-fire, escalating facts.
4. 0:45-0:55 (The Mind-Bending Reveal): The ultimate climax of the awe.
5. 0:55-0:60 (The Seamless Loop): End on an ambiguous or perfectly circular final thought that flawlessly bleeds back into the opening hook to maximize re-watches.`;
                } else {
                    if (j === 1) {
                        actTitleText = 'Act 1 (The Cold Open & The Thesis)';
                        actFocusText = 'The Cold Open (0:00-0:45): Do not introduce yourself. Start immediately in the middle of a gripping, strange, or terrifying concept. The Thesis (0:45-1:30): Introduce the core impossible question the video will answer.';
                    } else if (j === numActs) {
                        actTitleText = `Act ${j} (The Grand Unification & Poetic Exit)`;
                        actFocusText = 'The Grand Unification: Bring every loose thread and scientific fact together into one cohesive, jaw-dropping conclusion. The Poetic Exit (Final 30 Seconds): Do not ask them to subscribe. Deliver a haunting, poetic, or deeply thought-provoking final statement that leaves them staring in silence.';
                    } else {
                        actTitleText = `Act ${j} (The Deep Dive & False Climax)`;
                        actFocusText = `The False Climax: About halfway through this act, provide an answer that seems satisfying, and then immediately destroy it ("But that theory has one massive flaw..."). The Deep Descent: Unpack the science or psychology step-by-step using short, punchy sentences. Keep the atmosphere thick and gripping. Inject a new paradigm shift every 4-5 minutes to reset dopamine.`;
                    }
                }
                
                const actUserPrompt = `Write ${actTitleText} for the video: "${finalScriptData.title}".
Niche context: ${finalScriptData.nicheReason}
${actFocusText}


Last spoken lines of previous section: "${lastVoContext}"

${charactersPromptGuide}


SCRIPTWRITING & PACING LAWS:
1. Mesmerizing Storytelling: Use short, punchy sentences. Ask profound questions, then answer them with mind-bending facts. The tone is cinematic and serious.
2. Short Voiceovers & Fast Visual Hooking: To maximize user retention, the visual layout MUST update every 1.5 to 3 seconds. Therefore:
   - Keep the voiceover script for any single scene EXTREMELY short (maximum 10 words, ideal is 5 to 8 words per scene).
   - If a sentence is long, you MUST split it across multiple consecutive scenes.
   - Prefixed Emotional Performance (Tagging): Prefix the "voiceover" text for every single scene with an acting instruction (e.g., 'Read with quiet, chilling authority: "..."', 'Read with profound fascination: "..."', 'Read softly and deliberately: "..."'). Always wrap the spoken clause inside double quotes inside the string.
   - Calculate duration strictly using only the spoken words inside the double quotes.
3. Literal Visual Syncing (CRITICAL): The "prompt" field MUST exactly match the words being spoken. The visuals must perfectly depict the literal concepts or metaphors the voiceover is describing in that exact moment.
4. Perfect Voiceover-to-Duration Math: The "duration" field must match the actual speaking time of the voiceover text. Use these metrics:
   - 1 to 4 words = 2 seconds
   - 5 to 7 words = 3 seconds
   - 8 to 10 words = 4 seconds
   Never put more than 10 spoken words in a single scene.
5. Aspect Ratio: The layout format is ${videoType === 'short' ? '9:16 vertical portrait format' : '16:9 widescreen landscape format'}. Make sure all visual prompts specify this format.
6. Single Unified Image Prompt: In the "prompt" field, write one single unified prompt blending the camera direction, the EXACT literal action reflecting the voiceover (following the Stateless Prompt Rule), and text overlays ONLY if necessary.
Never output the exact same visual prompt for different scenes.

Generate as many consecutive scenes as you intelligently decide are needed for this act of the video (aim for approximately 15 to 30 scenes to keep the pacing correct, but you have full creative control over the exact count based on how many scenes are needed to explain the content beautifully without rushing or lagging).

Return strictly a JSON object matching this schema:
{
  "scenes": [
    {
      "duration": [2, 3, or 4],
      "voiceover": "[Voice performance instruction followed by spoken clause inside double quotes, e.g. 'Read with energy and enthusiasm: \"Hey everyone!\"']",
      "prompt": "[Complete, unified stateless visual prompt blending camera direction, action, and extremely rare text overlay instructions. Follow Stateless Prompt Rule. White background]"
    }
  ]
}`;

                let actResponse;
                if (useGemini) {
                    actResponse = await callGeminiAPI(actSystemPrompt, actUserPrompt, geminiKey, geminiModelName, true);
                } else {
                    actResponse = await callOpenRouter(actSystemPrompt, actUserPrompt, apiKey, model, true);
                }
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
3. Keep the art style: clean, hand-drawn 2D vector-style cartoon illustration, smooth black felt-pen outlines, flat color fills, solid white background.

Character Presets:
${charsString}

Input Prompt to fix: "${scene.prompt}"
Return only the corrected prompt text, nothing else.`;

                        try {
                            let correctedText;
                            const qcSystemPrompt = "You are an AI assistant that corrects image generator prompts to be stateless and pronoun-free. You must strictly avoid pronouns (he, she, it, they, his, her, their, its) and relative references (same, previous, earlier, above, below, again). Specifically, never output the word 'above' or 'below' or 'same' or 'he' or 'his' in your output under any circumstances. Replace them with concrete, absolute descriptions.";
                            if (useGemini) {
                                correctedText = await callGeminiAPI(qcSystemPrompt, prompt, geminiKey, geminiModelName, false);
                            } else {
                                correctedText = await callOpenRouter(qcSystemPrompt, prompt, apiKey, model);
                            }
                            
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
            
            // --- COST CALCULATOR (LLM BASE) ---
            // DeepSeek V4 Flash via OpenRouter: ~$0.09/$0.18 per 1M tokens
            // Avg script gen: ~5k input + 8k output = (5000*0.09 + 8000*0.18) / 1,000,000 = $0.00189 ≈ $0.002
            finalScriptData.estimatedCost = {
                images: 0,
                audio: 0,
                llm: 0.002,
                total: 0.002
            };
            addJobLog(`💰 Base LLM Scripting Cost: $0.002`);
            // ---------------------------------
            
            writeLatestScript(finalScriptData);
            // Save permanently to history database
            const savedFilename = await saveScriptToHistory(finalScriptData);
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

async function callGeminiImagenAPI(promptText, apiKey, videoType) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;
    const aspectHint = videoType === 'short' ? 'vertical portrait 9:16 aspect ratio' : 'horizontal landscape 16:9 aspect ratio';
    const fullPrompt = `${promptText}. Generate this image in ${aspectHint}.`;
    const payload = JSON.stringify({
        contents: [
            {
                parts: [
                    {
                        text: fullPrompt
                    }
                ]
            }
        ],
        generationConfig: {
            responseModalities: ["IMAGE"]
        }
    });
    const headers = {
        'Content-Type': 'application/json'
    };
    try {
        const res = await httpsPost(url, headers, payload);
        const data = JSON.parse(res.body.toString());
        if (data.error) {
            throw new Error(data.error.message || 'Gemini 2.5 Flash Image API error');
        }
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
            const parts = data.candidates[0].content.parts;
            for (const part of parts) {
                if (part.inlineData && part.inlineData.data) {
                    return Buffer.from(part.inlineData.data, 'base64');
                }
            }
        }
        throw new Error('Invalid Gemini 2.5 Flash Image API response structure');
    } catch (e) {
        throw new Error(`Google Gemini Image Call Failed: ${e.message}`);
    }
}

function startBackendSynthesis(script, falApiKey, elevenlabsApiKey, providedOutputPath, providedOpenRouterApiKey, providedGeminiApiKey, synthesisMode = 'audio_and_images') {
    activeJob.status = 'running';
    activeJob.jobType = 'synthesis';
    activeJob.logs = [];
    activeJob.error = null;
    activeJob.script = script;
    activeJob.stages = [];
    
    (async () => {
        const audioOnly = synthesisMode === 'audio_only';
        addJobLog(`⚡ Starting background ${audioOnly ? 'VOICE-ONLY' : 'full media'} synthesis for script: "${script.title}"`);
        if (audioOnly) addJobLog(`🎙️ Mode: Audio Only — skipping image generation entirely.`);
        try {
            const config = readConfig();
            const geminiApiKey = providedGeminiApiKey || config.geminiApiKey || '';
            const targetDir = config.outputPath || path.join(__dirname, 'output');
            const imagesDir = path.join(targetDir, 'images');
            const audioDir = path.join(targetDir, 'audio');
            const thumbnailsDir = path.join(targetDir, 'thumbnails');
            
            ensureDir(targetDir);
            ensureDir(imagesDir);
            ensureDir(audioDir);
            ensureDir(thumbnailsDir);
            
            const scenes = script.scenes || [];
            addJobLog(`⚙️ Synthesizing media for ${scenes.length} scenes...`);
            
            // 1. Generate Thumbnail Image (skip in audio_only mode)
            let thumbnailPath = '';
            if (script.thumbnail && !audioOnly) {
                let thumbBuffer = null;
                let thumbGenerated = false;

                if (geminiApiKey && geminiApiKey.trim().length > 10) {
                    addJobLog(`🎨 [Gemini Imagen] Synthesizing custom thumbnail image...`);
                    try {
                        thumbBuffer = await callGeminiImagenAPI(script.thumbnail, geminiApiKey.trim(), script.videoType);
                        thumbGenerated = true;
                        addJobLog(`✓ [Gemini Imagen] Custom thumbnail image completed.`);
                    } catch (err) {
                        addJobLog(`⚠️ [Gemini Imagen] Thumbnail synthesis failed: ${err.message}. Trying Fal.ai fallback...`);
                    }
                }

                if (!thumbGenerated) {
                    addJobLog(`🎨 [Replicate] Synthesizing custom thumbnail image...`);
                    try {
                        const replicateApiKey = process.env.REPLICATE_API_KEY || falApiKey;
                        const payload = JSON.stringify({
                            input: {
                                prompt: script.thumbnail,
                                aspect_ratio: script.videoType === 'short' ? '9:16' : '16:9'
                            }
                        });
                        const imgUrl = await callReplicateWithRetry(payload, replicateApiKey, addJobLog);
                        thumbBuffer = await httpsGet(imgUrl);
                        thumbGenerated = true;
                        addJobLog(`✓ [Replicate] Custom thumbnail image completed.`);
                    } catch (err) {
                        addJobLog(`⚠️ [Replicate] Thumbnail synthesis failed: ${err.message}`);
                    }
                }

                if (thumbGenerated && thumbBuffer) {
                    try {
                        const slug = (script.title || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 50);
                        const thumbName = `thumb_${script.timestamp || Date.now()}_${slug}.png`;
                        const fullThumbPath = path.join(thumbnailsDir, thumbName);
                        
                        await fs.promises.writeFile(fullThumbPath, thumbBuffer);
                        thumbnailPath = `/output/thumbnails/${thumbName}`;
                        addJobLog(`✓ Custom thumbnail saved: ${thumbnailPath}`);
                    } catch (saveErr) {
                        addJobLog(`⚠️ Failed to save thumbnail file: ${saveErr.message}`);
                    }
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
                // Named MP3: first 2 words of title + zero-padded scene number
                const audioFileName = getAudioFileName(script.title, i);
                const audioPath = path.join(audioDir, audioFileName);
                
                scene.imagePath = `/output/images/scene_${indexStr}.png`;
                scene.audioPath = `/output/audio/${audioFileName}`;
                
                // Image synthesis — skip entirely in audio_only mode
                if (!audioOnly) {
                    let imgBuffer = null;
                    let imgGenerated = false;

                    if (geminiApiKey && geminiApiKey.trim().length > 10) {
                        try {
                            addJobLog(`[Gemini Imagen] Scene ${i+1}/${scenes.length} generating image...`);
                            imgBuffer = await callGeminiImagenAPI(scene.prompt, geminiApiKey.trim(), script.videoType);
                            imgGenerated = true;
                            addJobLog(`✓ [Gemini Imagen] Scene ${i+1}/${scenes.length} image completed.`);
                        } catch (geminiErr) {
                            addJobLog(`⚠️ [Gemini Imagen] failed for scene ${i+1}: ${geminiErr.message}. Trying Fal.ai fallback...`);
                        }
                    }

                    if (!imgGenerated) {
                        try {
                            addJobLog(`[Replicate] Scene ${i+1}/${scenes.length} generating image...`);
                            const replicateApiKey = process.env.REPLICATE_API_KEY || falApiKey;
                            const payload = JSON.stringify({
                                input: {
                                    prompt: scene.prompt,
                                    aspect_ratio: script.videoType === 'short' ? '9:16' : '16:9'
                                }
                            });
                            const imgUrl = await callReplicateWithRetry(payload, replicateApiKey, addJobLog);
                            imgBuffer = await httpsGet(imgUrl);
                            imgGenerated = true;
                            addJobLog(`✓ [Replicate] Scene ${i+1}/${scenes.length} image completed.`);
                        } catch (err) {
                            addJobLog(`⚠️ [Replicate] failed for scene ${i+1}: ${err.message}. Saving fallback.`);
                        }
                    }

                    if (imgGenerated && imgBuffer) {
                        await fs.promises.writeFile(imgPath, imgBuffer);
                    } else {
                        addJobLog(`ℹ️ Saving mock canvas image for scene ${i+1}`);
                        await fs.promises.writeFile(imgPath, Buffer.from(MOCK_PNG_BASE64, 'base64'));
                    }
                }
                
                // Audio synthesis — always generate, save as named MP3 via FFmpeg
                const openRouterApiKey = providedOpenRouterApiKey || config.apiKey || FIXATED_KEY;
                const spokenText = extractSpokenText(scene.voiceover);
                
                if (openRouterApiKey && openRouterApiKey.trim().length > 10 && scene.voiceover) {
                    try {
                        addJobLog(`[OpenRouter] Scene ${i+1}/${scenes.length} generating voiceover...`);
                        const voiceBuffer = await callOpenRouterAudio(spokenText, openRouterApiKey.trim());
                        await saveAudioAsMP3(voiceBuffer, audioPath);
                        addJobLog(`✓ [OpenRouter] Scene ${i+1}/${scenes.length} voiceover saved as ${audioFileName}.`);
                    } catch (err) {
                        addJobLog(`⚠️ OpenRouter Audio failed for scene ${i+1}: ${err.message}. Trying Replicate Gemini TTS...`);
                        
                        const replicateApiKey = process.env.REPLICATE_API_KEY || falApiKey;
                        let geminiSuccess = false;
                        if (replicateApiKey && replicateApiKey.trim().length > 10) {
                            try {
                                const payload = JSON.stringify({
                                    input: {
                                        text: spokenText,
                                        voice: "Kore",
                                        prompt: scene.voiceover.replace(/"[^"]+"/g, '').trim() || "Say the following with professional documentary tone."
                                    }
                                });
                                const audioUrl = await callReplicateWithRetry(
                                    payload, 
                                    replicateApiKey.trim(), 
                                    addJobLog, 
                                    "https://api.replicate.com/v1/models/google/gemini-3.1-flash-tts/predictions"
                                );
                                const audioBuffer = await httpsGet(audioUrl);
                                await saveAudioAsMP3(audioBuffer, audioPath);
                                addJobLog(`✓ [Replicate Gemini TTS] Scene ${i+1}/${scenes.length} voiceover saved as ${audioFileName}.`);
                                geminiSuccess = true;
                            } catch (geminiErr) {
                                addJobLog(`⚠️ Replicate Gemini TTS failed for scene ${i+1}: ${geminiErr.message}.`);
                            }
                        }
                        
                        if (!geminiSuccess) {
                            if (elevenlabsApiKey && elevenlabsApiKey.trim().length > 10) {
                                try {
                                    const payload = JSON.stringify({
                                        text: spokenText,
                                        model_id: "eleven_monolingual_v1",
                                        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
                                    });
                                    const res = await httpsPost(
                                        "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM",
                                        {
                                            "xi-api-key": elevenlabsApiKey.trim(),
                                            "Content-Type": "application/json"
                                        },
                                        payload
                                    );
                                    await saveAudioAsMP3(res.body, audioPath);
                                    addJobLog(`✓ [ElevenLabs] Scene ${i+1}/${scenes.length} voiceover saved as ${audioFileName}.`);
                                } catch (elErr) {
                                    addJobLog(`⚠️ ElevenLabs fallback failed for scene ${i+1}: ${elErr.message}. Saving silent fallback.`);
                                    const duration = parseFloat(scene.duration) || 2;
                                    await saveAudioAsMP3(getSilentWavBuffer(duration), audioPath);
                                }
                            } else {
                                const duration = parseFloat(scene.duration) || 2;
                                await saveAudioAsMP3(getSilentWavBuffer(duration), audioPath);
                            }
                        }
                    }
                } else if (elevenlabsApiKey && elevenlabsApiKey.trim().length > 10 && spokenText) {
                    try {
                        const payload = JSON.stringify({
                            text: spokenText,
                            model_id: "eleven_monolingual_v1",
                            voice_settings: { stability: 0.5, similarity_boost: 0.75 }
                        });
                        const res = await httpsPost(
                            "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM",
                            {
                                "xi-api-key": elevenlabsApiKey.trim(),
                                "Content-Type": "application/json"
                            },
                            payload
                        );
                        await saveAudioAsMP3(res.body, audioPath);
                        addJobLog(`[ElevenLabs] Scene ${i+1}/${scenes.length} voiceover saved as ${audioFileName}.`);
                    } catch (err) {
                        addJobLog(`⚠️ ElevenLabs failed for scene ${i+1}: ${err.message}. Saving silent fallback.`);
                        const duration = parseFloat(scene.duration) || 2;
                        await saveAudioAsMP3(getSilentWavBuffer(duration), audioPath);
                    }
                } else {
                    const duration = parseFloat(scene.duration) || 2;
                    await saveAudioAsMP3(getSilentWavBuffer(duration), audioPath);
                }
            }
            
            script.assetsSynthesized = true;
            if (thumbnailPath) script.thumbnailPath = thumbnailPath;
            script.timestamp = Date.now();
            
            // --- COST CALCULATOR ---
            // Exact pricing from official API pages:
            // Flux Schnell (Replicate): $3 per 1000 images = $0.003/image
            // Gemini TTS (Replicate): $2/M input + $0.04/1k output tokens
            //   Avg scene: ~200 input tokens + ~80 output tokens
            //   = (200*2 + 80*40) / 1,000,000 = $0.0004 + $0.0032 = $0.0036 ≈ $0.004/scene
            // DeepSeek V4 Flash LLM: already counted in script gen base cost ($0.002)
            const costPerImage = 0.003;  // Exact: Flux Schnell $3/1000 images
            const costPerAudio = 0.004;  // Exact: Gemini TTS ~$0.004 per scene average
            const baseLLMCost = script.estimatedCost ? (script.estimatedCost.llm || 0.002) : 0.002;
            const numScenes = scenes.length;
            
            script.estimatedCost = {
                images: Number((numScenes * costPerImage).toFixed(4)),
                audio: Number((numScenes * costPerAudio).toFixed(4)),
                llm: baseLLMCost,
                total: Number(((numScenes * costPerImage) + (numScenes * costPerAudio) + baseLLMCost).toFixed(4))
            };
            addJobLog(`💰 Estimated API Cost for this video: $${script.estimatedCost.total.toFixed(4)} (${numScenes} scenes × $0.003 img + $0.004 audio + $${baseLLMCost} LLM)`);
            // -----------------------
            
            writeLatestScript(script);
            if (script.historyFilename) {
                await updateScriptInHistory(script.historyFilename, script);
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
                const targetDir = config.outputPath || path.join(__dirname, 'output');
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
                
                const batchSize = 1;
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
                        const audioFileName = getAudioFileName(script.title, sceneIndex);
                        const audioPath = path.join(audioDir, audioFileName);
                        
                        // Dynamic check/write of fallback assets if missing
                        if (!fs.existsSync(imgPath)) {
                            fs.writeFileSync(imgPath, Buffer.from(MOCK_PNG_BASE64, 'base64'));
                        }
                        if (!fs.existsSync(audioPath)) {
                            const duration = parseFloat(scene.duration) || 2;
                            fs.writeFileSync(audioPath, getSilentWavBuffer(duration));
                        }

                        const tempSceneVideo = path.join(targetDir, `temp_scene_${indexStr}.mp4`);
                        const duration = parseFloat(scene.duration) || 2;
                        
                        const scaleFilter = script.videoType === 'short' 
                            ? `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=25`
                            : `scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=25`;
                        
                        const cmd = `ffmpeg -nostdin -y -loop 1 -t ${duration} -framerate 25 -i "${imgPath}" -i "${audioPath}" -c:v libx264 -preset fast -pix_fmt yuv420p -vf "${scaleFilter}" -c:a aac -b:a 192k -shortest "${tempSceneVideo}"`;
                        
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
                const concatCmd = `ffmpeg -nostdin -y -f concat -safe 0 -i "${inputsTxtPath}" -c copy "${finalVideoPath}"`;
                
                exec(concatCmd, (concatErr) => {
                    // Use an async IIFE so we can await inside and catch errors cleanly
                    (async () => {
                        try {
                            tempVideoFiles.forEach(file => {
                                try { fs.unlinkSync(file); } catch(e){}
                            });
                            try { fs.unlinkSync(inputsTxtPath); } catch(e){}
                            
                            if (concatErr) {
                                activeJob.status = 'failed';
                                activeJob.error = `Concatenation failed: ${concatErr.message}`;
                                addJobLog(`❌ Concatenation failed: ${concatErr.message}`);
                                return;
                            }

                            const stats = fs.statSync(finalVideoPath);
                            script.videoPath = `/output/videos/${videoFilename}`;
                            script.timestamp = Date.now();

                            // --- COST CALCULATOR (MERGE WITH EXISTING) ---
                            const costPerImage = 0.003;
                            const costPerAudio = 0.01;
                            const numScenes = Array.isArray(scenes) ? scenes.length : 0;

                            const imagesCost = Number((numScenes * costPerImage).toFixed(3));
                            const audioCost = Number((numScenes * costPerAudio).toFixed(3));
                            const existingLlm = script.estimatedCost && typeof script.estimatedCost.llm === 'number' ? script.estimatedCost.llm : 0.005;
                            const totalCost = Number((imagesCost + audioCost + existingLlm).toFixed(3));

                            // Preserve previously computed fields where appropriate and merge
                            script.estimatedCost = {
                                images: imagesCost,
                                audio: audioCost,
                                llm: existingLlm,
                                total: totalCost
                            };

                            addJobLog(`💰 Estimated API Cost for this video: $${script.estimatedCost.total.toFixed(3)}`);
                            // -----------------------

                            writeLatestScript(script);
                            if (script.historyFilename) {
                                try {
                                    await updateScriptInHistory(script.historyFilename, script);
                                } catch (uErr) {
                                    addJobLog(`⚠️ Failed to update history after concat: ${uErr.message}`);
                                }
                            }

                            activeJob.script = script;
                            activeJob.status = 'completed';
                            addJobLog(`🎉 Master video compilation finished successfully!`);
                            addJobLog(`💾 File saved: ${script.videoPath} (${stats.size} bytes)`);

                        } catch (e) {
                            addJobLog(`❌ Error in concatenation handler: ${e.message}`);
                            activeJob.status = 'failed';
                            activeJob.error = e.message;
                        }
                    })().catch(e => {
                        addJobLog(`❌ Unexpected concat handler failure: ${e.message}`);
                        activeJob.status = 'failed';
                        activeJob.error = e.message;
                    });
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
function httpsPost(url, headers, body, timeoutMs = 120000) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const options = {
            hostname: u.hostname,
            path: u.pathname + u.search,
            method: 'POST',
            headers: {
                ...headers,
                'Content-Length': Buffer.byteLength(body)
            },
            timeout: timeoutMs
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

        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Request timed out after ${timeoutMs / 1000}s: ${url}`));
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

const MOCK_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

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
        listScriptHistory().then(scripts => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ scripts }));
        }).catch(err => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        });
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
        loadScriptFromHistory(safeFilename).then(script => {
            if (!script) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Script not found in history' }));
                return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ script }));
        }).catch(err => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        });
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
        req.on('end', async () => {
            try {
                const { filename } = JSON.parse(body);
                const safeFilename = path.basename(filename);
                const deleted = await deleteScriptFromHistory(safeFilename);
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
        req.on('end', async () => {
            try {
                const { filename, script } = JSON.parse(body);
                if (!filename || !script) throw new Error('filename and script are required');
                const safeFilename = path.basename(filename);
                const updated = await updateScriptInHistory(safeFilename, script);
                if (!updated) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Script not found in history' }));
                    return;
                }
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

                const safeFilename = path.basename(filename || 'untitled.json');
                                // Prevent path traversal by only allowing the basename
                                const filePath = path.join(targetDir, safeFilename);
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
                const { script, apiKey, falApiKey, elevenlabsApiKey, geminiApiKey, outputPath, synthesisMode } = data;
                if (!script) throw new Error("Script data is required");
                
                startBackendSynthesis(script, falApiKey, elevenlabsApiKey, outputPath, apiKey, geminiApiKey, synthesisMode || 'audio_and_images');
                
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
                
                const response = await callOpenRouter(systemPrompt, userPrompt, apiKey, model, true);
                
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
3. Keep the art style: clean, hand-drawn 2D vector-style cartoon illustration, smooth black felt-pen outlines, flat color fills, solid white background.

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

    // Health endpoint
    if (pathname === '/api/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', uptime: process.uptime(), activeJob: activeJob.status, timestamp: Date.now() }));
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

    // Audio download endpoint — serves a WAV or MP3 file as a downloadable attachment
    if (pathname.startsWith('/api/audio-download/')) {
        const filename = path.basename(pathname);
        const config = readConfig();
        const targetDir = config.outputPath || path.join(__dirname, 'output');
        const filePath = path.join(targetDir, 'audio', filename);
        const isAudio = filename.endsWith('.wav') || filename.endsWith('.mp3');
        if (!isAudio || !fs.existsSync(filePath)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Audio file not found' }));
            return;
        }
        const stat = fs.statSync(filePath);
        const mimeType = filename.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav';
        res.writeHead(200, {
            'Content-Type': mimeType,
            'Content-Length': stat.size,
            'Content-Disposition': `attachment; filename="${filename}"`
        });
        fs.createReadStream(filePath).pipe(res);
        return;
    }

    // DEBUG ENDPOINT to see what is actually in the audio folder
    if (pathname === '/api/debug-audio') {
        const config = readConfig();
        const targetDir = config.outputPath || path.join(__dirname, 'output');
        const audioDir = path.join(targetDir, 'audio');
        let files = [];
        let exists = fs.existsSync(audioDir);
        if (exists) {
            files = fs.readdirSync(audioDir).map(file => {
                const stat = fs.statSync(path.join(audioDir, file));
                return { name: file, size: stat.size, time: stat.mtime };
            });
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            targetDir,
            audioDir,
            exists,
            files
        }));
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
