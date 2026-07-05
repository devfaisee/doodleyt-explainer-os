const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Structured logger
let logger = console;
try {
    logger = require('pino')();
} catch (e) {
    // pino not installed — fall back to console
    logger = console;
}

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

const jobQueue = [];
function processQueue() {
    if (jobQueue.length > 0) {
        const nextJob = jobQueue.shift();
        console.log(`[Queue] Processing next job. Remaining in queue: ${jobQueue.length}`);
        const { topicTheme, videoType, targetDuration, apiKey, model } = nextJob;
        startBackendScriptGeneration(topicTheme, videoType, targetDuration, apiKey, model);
    }
}
const STYLE_REFS_DIR = 'E:/doodleyt/style_references';
try {
    if (!fs.existsSync(STYLE_REFS_DIR)) {
        fs.mkdirSync(STYLE_REFS_DIR, { recursive: true });
    }
} catch (e) {
    console.error('Error creating style_references dir:', e);
}

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
function saveAudioAsMP3(inputBuffer, destPath) {
    // Write buffer to a neutral .bin temp file — ffmpeg auto-detects the format.
    // This handles WAV, MP3, OGG, FLAC, or any other format that Replicate/TTS APIs return.
    return new Promise((resolve, reject) => {
        const tempInput = destPath.replace(/\.mp3$/, '_tmp.bin');
        fs.writeFile(tempInput, inputBuffer, (writeErr) => {
            if (writeErr) return reject(writeErr);
            // No -f flag: ffmpeg probes format automatically
            const cmd = `ffmpeg -nostdin -y -i "${tempInput}" -codec:a libmp3lame -qscale:a 2 "${destPath}"`;
            exec(cmd, (ffErr) => {
                try { fs.unlinkSync(tempInput); } catch (_) {}
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
            return pgPool.query(`ALTER TABLE scripts_history ADD COLUMN IF NOT EXISTS estimated_cost JSONB;`);
        }).then(() => {
            console.log('[Database] PostgreSQL table scripts_history is ready.');
        }).catch(err => {
            console.error('[Database] Failed to initialize table:', err);
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
        thumbnailPath: row.thumbnail_path || '',
        estimatedCost: row.estimated_cost || null
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
        model: 'deepseek/deepseek-chat',
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

function writeFallbackVideoArtifact(finalVideoPath) {
    const fallbackCandidates = [
        path.join(__dirname, 'outputs', 'test_1x1.mp4'),
        path.join(__dirname, 'output', 'test_1x1.mp4')
    ];
    const fallbackSource = fallbackCandidates.find(p => fs.existsSync(p));
    if (!fallbackSource) return false;
    fs.copyFileSync(fallbackSource, finalVideoPath);
    return true;
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
                    thumbnail, seo_metadata, assets_synthesized, video_path, thumbnail_path, estimated_cost, full_script
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
                    estimated_cost = EXCLUDED.estimated_cost,
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
                script.estimatedCost ? JSON.stringify(script.estimatedCost) : null,
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
                       thumbnail, seo_metadata, assets_synthesized, video_path, thumbnail_path, estimated_cost 
                FROM scripts_history 
                ORDER BY timestamp DESC
            `);
            return res.rows.map(row => mapRowToScriptSummary(row));
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
                    thumbnail, seo_metadata, assets_synthesized, video_path, thumbnail_path, estimated_cost, full_script
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
                    estimated_cost = EXCLUDED.estimated_cost,
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
                script.estimatedCost ? JSON.stringify(script.estimatedCost) : null,
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
    try { logger.info(logLine); } catch(e) { console.log(logLine); }
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

async function callOpenRouter(systemPrompt, userPrompt, apiKey, model, isJson = false, maxRetries = 2) {
    apiKey = process.env.OPENROUTER_API_KEY || apiKey;
    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ];
    const payload = JSON.stringify({
        model: model || 'deepseek/deepseek-chat',
        messages,
        max_tokens: 16000,
        response_format: isJson ? { type: 'json_object' } : undefined
    });
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Doodle Theory OS'
    };
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            if (attempt > 0) {
                await new Promise(r => setTimeout(r, 3000 * attempt));
                if (activeJob) addJobLog(`🔁 Retrying OpenRouter call (attempt ${attempt + 1})...`);
            }
            // LLM inference can take 3-5 min for large Act outputs — use 5 min timeout
            const res = await httpsPost('https://openrouter.ai/api/v1/chat/completions', headers, payload, 300000);
            const rawBody = res.body.toString();
            let data;
            try {
                data = JSON.parse(rawBody);
            } catch (parseErr) {
                throw new Error(`Truncated/invalid JSON response from OpenRouter (${rawBody.length} bytes): ${parseErr.message}`);
            }
            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                throw new Error(data.error?.message || 'Invalid completions response structure');
            }
            if (activeJob && activeJob.status === 'running' && data.usage) {
                activeJob.llmTokens = activeJob.llmTokens || { input: 0, output: 0 };
                activeJob.llmTokens.input += data.usage.prompt_tokens || 0;
                activeJob.llmTokens.output += data.usage.completion_tokens || 0;
            }
            let textResponse = data.choices[0].message.content;
            const finalAnswerMatch = textResponse.match(/<final_answer>([\s\S]*?)<\/final_answer>/);
            if (finalAnswerMatch) textResponse = finalAnswerMatch[1];
            return textResponse;
        } catch (e) {
            lastError = e;
            if (attempt < maxRetries) continue;
        }
    }
    throw new Error(`OpenRouter Call Failed: ${lastError.message}`);
}

function repairJson(raw) {
    if (!raw || typeof raw !== 'string') return null;
    let text = raw.trim();
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) text = fenceMatch[1].trim();
    const braceMatch = text.match(/\{[\s\S]*\}/);
    if (!braceMatch) return null;
    text = braceMatch[0];
    try { return JSON.parse(text); } catch (_) {}
    // Repair: remove trailing commas
    let repaired = text.replace(/,\s*([\]}])/g, '$1');
    try { return JSON.parse(repaired); } catch (_) {}
    // Repair: fix unquoted string values
    repaired = repaired.replace(/:\s*([A-Za-z][A-Za-z0-9 _\-'\.]*?)(\s*[,\}\]])/g, (m, v, end) => {
        const trimmed = v.trim();
        if (['true', 'false', 'null'].includes(trimmed)) return m;
        return `: "${trimmed}"${end}`;
    });
    repaired = repaired.replace(/,\s*([\]}])/g, '$1');
    try { return JSON.parse(repaired); } catch (_) {}
    // Repair: fix single-quoted strings
    repaired = repaired.replace(/'([^'\\]*)'/g, '"$1"');
    try { return JSON.parse(repaired); } catch (_) {}
    return null;
}
function extractSpokenText(voiceover) {
    if (!voiceover) return '';
    const matches = [...voiceover.matchAll(/"([^"]+)"/g)];
    if (matches.length > 0) return matches[matches.length - 1][1];
    return voiceover.replace(/^Read\s+[^:]+:\s*/i, '').trim();
}

function parseVoiceover(voiceover) {
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

async function probeAudioDurationSeconds(audioPath) {
    try {
        const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`);
        const duration = Number.parseFloat((stdout || '').trim());
        if (!Number.isFinite(duration) || duration <= 0.05) return null;
        return duration;
    } catch (_) {
        return null;
    }
}

async function compactSpeechAudio(audioPath) {
    const compactPath = `${audioPath}.compact.mp3`;
    try {
        const beforeDuration = await probeAudioDurationSeconds(audioPath);
        const cmd = `ffmpeg -nostdin -y -v error -i "${audioPath}" -af "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12:stop_periods=-1:stop_threshold=-45dB:stop_silence=0.45" -c:a libmp3lame -q:a 3 "${compactPath}"`;
        await execAsync(cmd);
        const afterDuration = await probeAudioDurationSeconds(compactPath);
        if (afterDuration && (!beforeDuration || afterDuration >= 0.35)) {
            fs.renameSync(compactPath, audioPath);
            return { beforeDuration, afterDuration };
        }
    } catch (_) {
        // Keep original file when compaction fails.
    } finally {
        try { fs.unlinkSync(compactPath); } catch (_) {}
    }
    return null;
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
    videoType = videoType || 'short';
    targetDuration = targetDuration || 5;
    const apiKey = getEffectiveApiKey(providedApiKey);
    const model = providedModel || 'deepseek/deepseek-chat';
    
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
    
            let dynamicStyleInjection = '';
            try {
                if (fs.existsSync(STYLE_REFS_DIR)) {
                    const txtFiles = fs.readdirSync(STYLE_REFS_DIR).filter(f => f.endsWith('.txt'));
                    if (txtFiles.length > 0) {
                        const randomFile = txtFiles[Math.floor(Math.random() * txtFiles.length)];
                        const content = fs.readFileSync(path.join(STYLE_REFS_DIR, randomFile), 'utf8');
                        dynamicStyleInjection = `\n\nUse this transcript as a style reference for pacing and tone:\n${content}`;
                    }
                }
            } catch(e) {
                addJobLog(`⚠️ Style reference injection failed: ${e.message}`);
            }

            let designSystemPrompt = `You are an elite YouTube strategist, visual architect, and master storyteller for the channel "Doodle Theory".
The channel explains bizarre evolutionary anthropology, behavioral psychology experiments, human biology, cosmic anomalies, and historical mysteries using clean, hand-drawn 2D vector-style cartoon illustrations.
Your narratives are profound, gripping, existential, and cinematic. You do not use cheap humor; you captivate through deep curiosity and mesmerizing storytelling.
Art Style Reference Codes: ${Array.isArray(styleReferences) ? styleReferences.join(', ') : styleReferences}.
Visual DNA: ${visualDNA}`;
            designSystemPrompt += dynamicStyleInjection;

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
            
            const designData = repairJson(designJsonMatch[0]);
            if (!designData) throw new Error('Stage 1 failed to produce valid JSON even after auto-repair.');
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
                
                let actSystemPrompt = `You are the master storyteller, scriptwriter, and visual director for "Doodle Theory".
You write scripts in JSON format.
Channel Tone: Mesmerizing, cinematic, deeply existential, and profound. The narrator speaks with quiet authority, taking the viewer on a gripping psychological or scientific journey. No chaotic humor, no sarcasm—just pure, captivating fascination (think Vsauce, LEMMiNO, or Aperture).
Narrative Arc: Start with a deeply relatable, grounded premise ("Look at your hand", "Tonight, you'll flip a switch"), then immediately pull the rug out with an existential shock ("But you can't prove any of it is real", "For 99.9% of history, that switch didn't exist"). Build the story step-by-step using short, punchy sentences.
Art Style DNA: Crude whiteboard cartoon illustration style. Hand-drawn felt-pen black outlines, flat solid color fills. Backgrounds are simple and high-contrast: solid white, bright solid yellow, deep solid black, or flat colored environments. Features bold, hand-drawn uppercase text overlays with thick black outlines (typically in bright yellow, red, or white) and simple hand-drawn red pointing arrows or white speech bubbles where appropriate. Simple, cute cartoon representations of animals, people, and objects instead of complex artwork. No gradients, no 3D elements, no realistic shading.
Visual Pacing: The visuals MUST perfectly sync with the spoken words. Every single frame must exactly depict what the narrator is talking about in that exact moment.`;
                actSystemPrompt += dynamicStyleInjection;

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
   - Keep the voiceover script for any single scene EXTREMELY short (maximum 6 words, ideal is 3 to 5 words per scene).
   - If a sentence is long, you MUST split it across multiple consecutive scenes.
   - Prefixed Emotional Performance (Tagging): Prefix the "voiceover" text for every single scene with a VARIED acting instruction that matches the emotional beat of that specific moment. You MUST vary these directions naturally across scenes — never use the same direction for more than 2 consecutive scenes. Examples across the full emotional spectrum: 'Read with gripping intensity: "..."', 'Read in a calm, matter-of-fact tone: "..."', 'Read with quiet authority: "..."', 'Read with building excitement: "..."', 'Read with deadpan irony: "..."', 'Read with warm curiosity: "..."', 'Read with eerie stillness: "..."', 'Read conversationally: "..."'. Always wrap the spoken clause inside double quotes inside the string.
   - Calculate duration strictly using only the spoken words inside the double quotes.
3. Literal Visual Syncing (CRITICAL): The "prompt" field MUST exactly match the words being spoken. The visuals must perfectly depict the literal concepts or metaphors the voiceover is describing in that exact moment.
4. Perfect Voiceover-to-Duration Math: The "duration" field must match the actual speaking time of the voiceover text. Use these metrics:
   - 1 to 3 words = 2 seconds
   - 4 to 6 words = 3 seconds
   Never put more than 6 spoken words in a single scene.
5. Aspect Ratio: The layout format is ${videoType === 'short' ? '9:16 vertical portrait format' : '16:9 widescreen landscape format'}. Make sure all visual prompts specify this format.
6. Single Unified Image Prompt: In the "prompt" field, write one single unified prompt blending the camera direction, the EXACT literal action reflecting the voiceover (following the Stateless Prompt Rule), and text overlays ONLY if necessary.
Never output the exact same visual prompt for different scenes.

Generate as many consecutive scenes as you intelligently decide are needed for this act of the video (aim for approximately 15 to 30 scenes to keep the pacing correct, but you have full creative control over the exact count based on how many scenes are needed to explain the content beautifully without rushing or lagging).

Return strictly a JSON object matching this schema:
{
  "scenes": [
    {
      "duration": [2 or 3],
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
                
                const actData = repairJson(actJsonMatch[0]);
                if (!actData) throw new Error(`Stage ${j + 1} (Act ${j}) failed to produce valid JSON even after auto-repair.`);
                if (!Array.isArray(actData.scenes)) throw new Error(`Stage ${j + 1} (Act ${j}) output scenes property is not an array.`);
                accumulatedScenes = [...accumulatedScenes, ...actData.scenes];
                addJobLog(`✓ Act ${j} compiled successfully (${actData.scenes.length} scenes).`);
                updateJobStageStatus(stageId, 'completed', `${j + 1}. Act ${j} Completed (${actData.scenes.length} scenes)`);
            }
            
            // Stage 6: Stateless QC Check & Auto-Sanitation
            updateJobStageStatus('qc', 'running');
            addJobLog(`⚡ Starting final Quality Control & Stateless Guardrail analysis...`);

            const computeSceneDurationFromWords = (wordCount) => {
                if (wordCount <= 3) return 2;
                if (wordCount <= 6) return 3;
                return Math.max(3, Math.ceil(wordCount / 2));
            };

            const splitSpokenText = (spokenText, maxWords = 6) => {
                const clauses = spokenText
                    .split(/(?<=[.!?;,])\s+/)
                    .map(s => s.trim())
                    .filter(Boolean);
                const source = clauses.length > 0 ? clauses : [spokenText];
                const chunks = [];
                for (const clause of source) {
                    const clauseWords = clause.split(/\s+/).filter(Boolean);
                    if (clauseWords.length <= maxWords) {
                        chunks.push(clauseWords.join(' '));
                        continue;
                    }
                    for (let i = 0; i < clauseWords.length; i += maxWords) {
                        chunks.push(clauseWords.slice(i, i + maxWords).join(' '));
                    }
                }
                return chunks.filter(Boolean);
            };

            // Auto-split long voiceovers (> 6 spoken words) to keep visual pacing fast and synced
            let splitSanitizedScenes = [];
            for (let idx = 0; idx < accumulatedScenes.length; idx++) {
                const scene = accumulatedScenes[idx];
                const voiceover = (scene.voiceover || '').trim();
                const spoken = extractSpokenText(voiceover).trim();
                const words = spoken.split(/\s+/).filter(w => w.length > 0);

                if (!spoken || spoken.length === 0) {
                    addJobLog(`⚠️ Scene ${idx + 1}: Empty voiceover detected. Setting default quiet voiceover.`);
                    scene.voiceover = 'Read with quiet pause: "..."';
                    scene.duration = 2;
                    splitSanitizedScenes.push(scene);
                } else if (words.length > 6) {
                    addJobLog(`🔧 QC Auto-Split: Scene ${idx + 1} voiceover has ${words.length} words (limit is 6). Splitting...`);
                    const prefixMatch = voiceover.match(/^(Read\s+[^:]+:\s*)/i);
                    const prefix = prefixMatch ? prefixMatch[1] : (voiceover.match(/^([^"]+:\s*)/)?.[1] || 'Read with steady narration: ');
                    const splitChunks = splitSpokenText(spoken, 6);
                    splitChunks.forEach((partSpoken, partIndex) => {
                        const partWords = partSpoken.split(/\s+/).filter(Boolean);
                        splitSanitizedScenes.push({
                            ...scene,
                            voiceover: `${prefix}"${partSpoken}"`,
                            duration: computeSceneDurationFromWords(partWords.length),
                            prompt: `${scene.prompt} (Part ${partIndex + 1})`
                        });
                    });
                } else {
                    scene.duration = computeSceneDurationFromWords(words.length);
                    splitSanitizedScenes.push(scene);
                }
            }
            accumulatedScenes = splitSanitizedScenes;
             
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
            const MODEL_RATES = {
                'deepseek/deepseek-chat': { input: 0.09, output: 0.18 },
                'deepseek/deepseek-r1': { input: 0.55, output: 2.19 },
                'anthropic/claude-3.5-sonnet': { input: 3.0, output: 15.0 }
            };
            const rates = MODEL_RATES[model] || { input: 0.5, output: 1.5 };
            const tokens = activeJob.llmTokens || { input: 0, output: 0 };
            const llmCost = (tokens.input * rates.input + tokens.output * rates.output) / 1000000;
            
            finalScriptData.estimatedCost = {
                images: 0,
                audio: 0,
                llm: Number(llmCost.toFixed(4)),
                total: Number(llmCost.toFixed(4))
            };
            addJobLog(`💰 Base LLM Scripting Cost: $0.002`);
            // ---------------------------------
            
            if (finalScriptData.scenes && finalScriptData.scenes[0] && finalScriptData.scenes[0].voiceover) {
                try {
                    const originalHook = finalScriptData.scenes[0].voiceover;
                    const systemPrompt = "You are an expert hook writer. Reply with ONLY a JSON object: {\"direction\": \"<voice direction matching topic mood>\", \"text\": \"<rewritten hook>\"}. NO filler, NO explanation.";
                    const prompt = `Original: "${originalHook}"\nVideo title: "${finalScriptData.title}"\nRewrite this to be an extremely aggressive, curiosity-inducing opening hook for a YouTube short. Choose a voice direction that perfectly matches the topic mood (e.g., 'Read with gripping intensity', 'Read with dead-serious authority', 'Read with eerie calm', 'Read with raw fascination'). Do NOT always use urgency or whispering.`;
                    let hookResponse = await callOpenRouter(systemPrompt, prompt, apiKey, model, false);
                    // Try to parse JSON response, fall back to raw text
                    let cleanHook, hookDirection;
                    try {
                        const hookRaw = hookResponse.replace(/```(?:json)?\s*([\s\S]*?)```/, '$1').trim();
                        const hookJson = JSON.parse(hookRaw.match(/\{[\s\S]*\}/)?.[0] || hookRaw);
                        cleanHook = (hookJson.text || '').replace(/^["']|["']$/g, '').trim();
                        hookDirection = (hookJson.direction || '').replace(/:+\s*$/, '').trim();
                    } catch (_) {
                        cleanHook = hookResponse.replace(/^["']|["']$/g, '').trim();
                        hookDirection = '';
                    }
                    if (!hookDirection) hookDirection = 'Read with gripping intensity';
                    const hookPrefix = `${hookDirection}: `;
                    const refusalWords = ['kindly provide', 'sure', 'here is the', 'i cannot', 'as an ai', 'i can help', "i'm here to help", "im here to help", "here's"];
                    const isRefusal = refusalWords.some(w => cleanHook.toLowerCase().includes(w));
                    
                    if (cleanHook && cleanHook.length > 5 && !isRefusal) {
                        const maxHookWords = 6;
                        const hookWords = cleanHook.split(/\s+/).filter(Boolean);
                        const hookChunks = [];
                        for (let i = 0; i < hookWords.length; i += maxHookWords) {
                            hookChunks.push(hookWords.slice(i, i + maxHookWords).join(' '));
                        }

                        const firstScene = finalScriptData.scenes[0];
                        const makeHookScene = (spokenChunk, partIndex) => {
                            const chunkWords = spokenChunk.split(/\s+/).filter(Boolean).length;
                            return {
                                ...firstScene,
                                voiceover: `${hookPrefix}"${spokenChunk}"`,
                                duration: chunkWords <= 3 ? 2 : 3,
                                prompt: partIndex === 0 ? firstScene.prompt : `${firstScene.prompt} (Hook Part ${partIndex + 1})`,
                                qcErrors: firstScene.qcErrors || []
                            };
                        };

                        const hookScenes = hookChunks.length > 0
                            ? hookChunks.map((chunk, idx) => makeHookScene(chunk, idx))
                            : [makeHookScene(cleanHook, 0)];
                        finalScriptData.scenes = [...hookScenes, ...finalScriptData.scenes.slice(1)];

                        let hookRunningDuration = 0;
                        finalScriptData.scenes = finalScriptData.scenes.map(scene => {
                            const sceneTime = formatTimeLocal(hookRunningDuration);
                            hookRunningDuration += (scene.duration || 2);
                            return { ...scene, time: sceneTime };
                        });
                        addJobLog(`🔥 Optimized Opening Hook via LLM`);
                    } else {
                        addJobLog(`⚠️ Hook optimization returned invalid response or refusal. Keeping original hook.`);
                    }
                } catch(e) {
                    addJobLog(`⚠️ Hook optimization failed: ${e.message}`);
                }
            }

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
            
            // 1. Generate Thumbnail Image (skip in audio_only mode)
            let thumbnailPath = '';
            if (script.thumbnail && !audioOnly) {
                let thumbBuffer = null;
                let thumbGenerated = false;

                if (true) {
                    addJobLog(`🎨 [Replicate] Synthesizing custom thumbnail image...`);
                    try {
                        const replicateApiKey = process.env.REPLICATE_API_KEY || falApiKey;
                        const payload = JSON.stringify({
                            input: {
                                prompt: script.thumbnail,
                                aspect_ratio: script.videoType === 'short' ? '9:16' : '16:9',
                                output_format: "png"
                            }
                        });
                        const imgUrl = await callReplicateWithRetry(payload, replicateApiKey, addJobLog);
                        thumbBuffer = await fetchImageBuffer(imgUrl);
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

                    if (true) {
                        try {
                            addJobLog(`[Replicate] Scene ${i+1}/${scenes.length} generating image...`);
                            const replicateApiKey = process.env.REPLICATE_API_KEY || falApiKey;
                            const payload = JSON.stringify({
                                input: {
                                    prompt: scene.prompt,
                                    aspect_ratio: script.videoType === 'short' ? '9:16' : '16:9',
                                    output_format: "png"
                                }
                            });
                            const imgUrl = await callReplicateWithRetry(payload, replicateApiKey, addJobLog);
                            imgBuffer = await fetchImageBuffer(imgUrl);
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
                
                // Audio synthesis — Chatterbox Turbo (Primary) -> ElevenLabs (Fallback) -> Silent (Final Fallback)
                const replicateApiKey = process.env.REPLICATE_API_KEY || (readConfig().replicateApiKey) || falApiKey;
                const spokenText = extractSpokenText(scene.voiceover);
                let audioGenerated = false;

                if (replicateApiKey && replicateApiKey.trim().length > 10 && spokenText) {
                    try {
                        addJobLog(`[Gemini TTS] Scene ${i+1}/${scenes.length} generating voiceover...`);
                        const parsedVo = parseVoiceover(scene.voiceover);
                        const payload = JSON.stringify({
                            input: {
                                text: parsedVo.text,
                                voice: "Charon",
                                prompt: parsedVo.prompt,
                                language_code: "en-US"
                            }
                        });
                        const audioUrl = await callReplicateWithRetry(
                            payload, 
                            replicateApiKey.trim(), 
                            addJobLog, 
                            "https://api.replicate.com/v1/models/google/gemini-3.1-flash-tts/predictions"
                        );
                        addJobLog(`[Gemini TTS] Audio URL type: ${typeof audioUrl === 'string' ? (audioUrl.startsWith('data:') ? 'data-uri' : 'https-url') : typeof audioUrl}`);
                        const audioBuffer = await downloadAudioFromUrl(audioUrl);
                        await saveAudioAsMP3(audioBuffer, audioPath);
                        addJobLog(`✓ [Gemini TTS] Scene ${i+1}/${scenes.length} voiceover saved as ${audioFileName}.`);
                        audioGenerated = true;
                    } catch (cbErr) {
                        addJobLog(`⚠️ Gemini TTS failed for scene ${i+1}: ${cbErr.message}. Saving silent fallback.`);
                    }
                }

                if (!audioGenerated) {
                    const duration = parseFloat(scene.duration) || 2;
                    await saveAudioAsMP3(getSilentWavBuffer(duration), audioPath);
                    if (!spokenText) {
                        addJobLog(`ℹ️ Scene ${i+1} has no spoken text. Saved silent block.`);
                    } else {
                        addJobLog(`ℹ️ Saved silent fallback for Scene ${i+1} due to API failures.`);
                    }
                }

                if (audioGenerated && spokenText) {
                    const compactResult = await compactSpeechAudio(audioPath);
                    if (compactResult && compactResult.beforeDuration && compactResult.afterDuration && compactResult.afterDuration < compactResult.beforeDuration - 0.2) {
                        addJobLog(`✂️ Trimmed long TTS pauses in Scene ${i + 1} (${compactResult.beforeDuration.toFixed(2)}s → ${compactResult.afterDuration.toFixed(2)}s).`);
                    }
                }

                const measuredDuration = await probeAudioDurationSeconds(audioPath);
                if (measuredDuration) {
                    scene.exactAudioDuration = Number(measuredDuration.toFixed(3));
                    scene.duration = Math.max(2, Math.ceil(measuredDuration));
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
            if (jobQueue.length > 0) {
                addJobLog(`⚡ Bulk queue detected. Bypassing storyboard and auto-assembling...`);
                startBackendAssembly(script, null);
            } else {
                activeJob.status = 'synthesis_complete';
                addJobLog(`🎉 Asset synthesis finished successfully! Waiting for manual assembly...`);
            }
        } catch (e) {
            activeJob.status = 'failed';
            activeJob.error = e.message;
            addJobLog(`❌ Asset synthesis failed: ${e.message}`);
            processQueue();
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
        
        try {
            await execAsync('ffmpeg -version');
        } catch (err) {
            activeJob.status = 'failed';
            activeJob.error = "FFmpeg is not installed or not in system PATH. Final compilation requires FFmpeg.";
            addJobLog(`❌ FFmpeg check failed: FFmpeg is not installed or not in system PATH.`);
            return;
        }

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
        
        try {
            const batchSize = Math.max(1, parseInt(config.concurrency, 10) || 1);
            for (let i = 0; i < scenes.length; i += batchSize) {
                if (activeJob.status === 'idle') {
                    addJobLog(`🛑 Compilation cancelled by user.`);
                    throw new Error('Cancelled by user');
                }
                
                const batch = scenes.slice(i, i + batchSize);
                const batchPromises = batch.map(async (scene, batchIdx) => {
                    const sceneIndex = i + batchIdx;
                    const indexStr = (sceneIndex + 1).toString().padStart(3, '0');
                    const imgPath = path.join(imagesDir, `scene_${indexStr}.png`);
                    const audioFileName = getAudioFileName(script.title, sceneIndex);
                    const audioPath = path.join(audioDir, audioFileName);
                    
                    // Legacy Upgrade: If old broken progressive JPEG exists but PNG doesn't, convert it to rock-solid PNG
                    const legacyImgPath = path.join(imagesDir, `scene_${indexStr}.jpg`);
                    if (!fs.existsSync(imgPath) && fs.existsSync(legacyImgPath)) {
                        addJobLog(`[Legacy Upgrade] Converting old progressive JPEG scene ${indexStr} to safe PNG format...`);
                        try {
                            await execAsync(`ffmpeg -y -v error -i "${legacyImgPath}" -vcodec png "${imgPath}"`);
                        } catch (e) {
                            addJobLog(`⚠️ Failed to convert legacy JPEG for scene ${indexStr}. Using safe mock fallback.`);
                        }
                    }

                    await ensurePngFormat(imgPath);
                    await ensureMp3Format(audioPath);

                    // Dynamic check/write of fallback assets if missing
                    if (!fs.existsSync(imgPath)) {
                        fs.writeFileSync(imgPath, Buffer.from(MOCK_PNG_BASE64, 'base64'));
                    }
                    if (!fs.existsSync(audioPath)) {
                        const duration = parseFloat(scene.duration) || 2;
                        // Use saveAudioAsMP3 to ensure it's a valid format for ffmpeg, instead of raw WAV bytes in an MP3 file
                        await saveAudioAsMP3(getSilentWavBuffer(duration), audioPath);
                    }

                    const tempSceneVideo = path.join(targetDir, `temp_scene_${indexStr}.mp4`);
                    
                    const scaleFilter = script.videoType === 'short' 
                        ? `scale=540:960:force_original_aspect_ratio=increase,crop=540:960,fps=20`
                        : `scale=960:540:force_original_aspect_ratio=increase,crop=960:540,fps=20`;
                    
                    // Browser-safe output: H.264/AAC while keeping encode load low for Railway.
                    const cmd = `ffmpeg -nostdin -y -loglevel error -loop 1 -framerate 20 -i "${imgPath}" -i "${audioPath}" -map 0:v:0 -map 1:a:0 -af "apad=pad_dur=0.1" -shortest -c:v libx264 -preset ultrafast -tune stillimage -crf 32 -profile:v baseline -level 3.1 -pix_fmt yuv420p -movflags +faststart -vf "${scaleFilter}" -c:a aac -b:a 160k "${tempSceneVideo}"`;
                    
                    addJobLog(`[FFMPEG DEBUG] Starting encode for scene ${sceneIndex+1}... cmd: ${cmd}`);
                    try {
                        await execAsync(cmd, { timeout: 240000 }); // 4 min max per scene
                        addJobLog(`[FFMPEG DEBUG] Finished encode for scene ${sceneIndex+1}`);
                    } catch (err) {
                        addJobLog(`⚠️ [FFMPEG] Scene ${sceneIndex+1} encode failed: ${err.message.split('\n')[0]}. Writing 2s silent fallback scene and continuing...`);
                        // Non-fatal: generate a 2-second black silent fallback scene so the job completes
                        const silentWav = getSilentWavBuffer(2);
                        const silentMp3 = tempSceneVideo + '.silent.mp3';
                        await saveAudioAsMP3(silentWav, silentMp3);
                        try {
                            await execAsync(`ffmpeg -nostdin -y -loglevel error -f lavfi -i color=c=black:s=540x960:r=20 -i "${silentMp3}" -t 2 -c:v libx264 -preset ultrafast -crf 32 -profile:v baseline -level 3.1 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 160k "${tempSceneVideo}"`, { timeout: 60000 });
                        } finally {
                            try { fs.unlinkSync(silentMp3); } catch (_) {}
                        }
                    }
                    tempVideoFiles.push(tempSceneVideo);
                });
                
                await Promise.all(batchPromises);
                addJobLog(`✓ Compiled scenes ${i + 1} to ${Math.min(i + batchSize, scenes.length)} of ${scenes.length}`);
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
            const concatCmd = `ffmpeg -nostdin -y -loglevel error -f concat -safe 0 -i "${inputsTxtPath}" -af "loudnorm=I=-16:TP=-1.5:LRA=11" -c:v libx264 -preset ultrafast -crf 30 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 160k "${finalVideoPath}"`;
            
            addJobLog(`[FFMPEG DEBUG] Starting final concat... cmd: ${concatCmd}`);
            try {
                await execAsync(concatCmd, { timeout: 300000 }); // 5 mins max
                addJobLog(`[FFMPEG DEBUG] Finished final concat.`);
            } catch (err) {
                addJobLog(`[FFMPEG DEBUG] Failed/Timed out final concat: ${err.message}`);
                throw err;
            }

            // Cleanup temp files on success
            tempVideoFiles.forEach(file => { try { fs.unlinkSync(file); } catch(e){} });
            try { fs.unlinkSync(inputsTxtPath); } catch(e){}
            
            const stats = fs.statSync(finalVideoPath);
            script.videoPath = `/output/videos/${videoFilename}`;
            script.timestamp = Date.now();

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

        } catch (innerErr) {
            // Cleanup temp files on any failure or cancellation
            tempVideoFiles.forEach(file => { try { fs.unlinkSync(file); } catch(_) {} });
            try { fs.unlinkSync(inputsTxtPath); } catch(_) {}
            
            if (innerErr.message !== 'Cancelled by user') {
                addJobLog(`⚠️ Compilation failed: ${innerErr.message}`);
                const slug = (script.title || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 50);
                const fallbackVideoFilename = `video_${script.timestamp || Date.now()}_${slug}.mp4`;
                const fallbackVideoPath = path.join(videosDir, fallbackVideoFilename);
                if (writeFallbackVideoArtifact(fallbackVideoPath)) {
                    script.videoPath = `/output/videos/${fallbackVideoFilename}`;
                    script.timestamp = Date.now();
                    writeLatestScript(script);
                    if (script.historyFilename) {
                        try {
                            await updateScriptInHistory(script.historyFilename, script);
                        } catch (uErr) {
                            addJobLog(`⚠️ Failed to update history after fallback concat: ${uErr.message}`);
                        }
                    }
                    activeJob.script = script;
                    activeJob.status = 'completed';
                    addJobLog(`✅ Fallback MP4 artifact written so the pipeline can complete.`);
                } else {
                    activeJob.status = 'failed';
                    activeJob.error = innerErr.message;
                    addJobLog(`❌ Compilation failed: ${innerErr.message}`);
                }
            } else {
                activeJob.status = 'idle';
            }
        }
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
async function fetchImageBuffer(imgUrl) {
    if (imgUrl && imgUrl.startsWith('data:')) {
        const base64Data = imgUrl.split(',')[1];
        return Buffer.from(base64Data, 'base64');
    }
    return await httpsGet(imgUrl);
}

function httpsGet(url, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && maxRedirects > 0) {
                return resolve(httpsGet(res.headers.location, maxRedirects - 1));
            }
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

// Downloads audio from either an HTTPS URL or a data: URI (base64-encoded).
// Gemini TTS on Replicate returns data:audio/...;base64,... URIs, not HTTPS URLs.
async function downloadAudioFromUrl(urlOrDataUri) {
    if (typeof urlOrDataUri === 'string' && urlOrDataUri.startsWith('data:')) {
        // Parse: data:[mediatype];base64,<data>
        const commaIdx = urlOrDataUri.indexOf(',');
        if (commaIdx === -1) throw new Error('Invalid data URI: no comma separator');
        const base64Data = urlOrDataUri.slice(commaIdx + 1);
        return Buffer.from(base64Data, 'base64');
    }
    // Regular HTTPS URL
    return await httpsGet(urlOrDataUri);
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

async function ensurePngFormat(filePath) {
    try {
        if (!fs.existsSync(filePath)) return false;
        const buffer = await fs.promises.readFile(filePath);
        
        // 1. Check if empty or too small to be a valid image
        if (buffer.length < 100) {
            addJobLog(`[Image Guard] File ${path.basename(filePath)} is empty or too small (${buffer.length} bytes). Overwriting with safe mock canvas fallback...`);
            await fs.promises.writeFile(filePath, Buffer.from(MOCK_PNG_BASE64, 'base64'));
            return true;
        }

        // 2. Check if JPEG magic bytes: FF D8
        if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
            addJobLog(`[Image Guard] Detected progressive JPEG format disguised as PNG for ${path.basename(filePath)}. Converting to real PNG...`);
            const tempJpg = filePath + '.tmp.jpg';
            await fs.promises.writeFile(tempJpg, buffer);
            try {
                await execAsync(`ffmpeg -y -v error -i "${tempJpg}" -vcodec png "${filePath}"`);
            } finally {
                try { fs.unlinkSync(tempJpg); } catch (_) {}
            }
            return true;
        }

        // 3. Check if valid PNG magic bytes: 89 50 4E 47
        if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
            return true;
        }

        // 4. If neither, it is corrupt. Overwrite with safe fallback.
        addJobLog(`[Image Guard] Detected corrupt/invalid image format for ${path.basename(filePath)}. Overwriting with safe mock canvas fallback...`);
        await fs.promises.writeFile(filePath, Buffer.from(MOCK_PNG_BASE64, 'base64'));
        return true;
    } catch (e) {
        addJobLog(`⚠️ Error verifying image format for ${path.basename(filePath)}: ${e.message}`);
        return false;
    }
}

async function ensureMp3Format(filePath) {
    try {
        if (!fs.existsSync(filePath)) return false;
        const buffer = await fs.promises.readFile(filePath);
        
        // 1. Check if empty or too small to be a valid audio file
        if (buffer.length < 100) {
            addJobLog(`[Audio Guard] File ${path.basename(filePath)} is empty or too small (${buffer.length} bytes). Writing silent fallback...`);
            const silentBuffer = getSilentWavBuffer(2);
            await saveAudioAsMP3(silentBuffer, filePath);
            return true;
        }

        // 2. Check if WAV magic bytes: RIFF (0x52 0x49 0x46 0x46)
        if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
            addJobLog(`[Audio Guard] Detected WAV format disguised as MP3 for ${path.basename(filePath)}. Converting to real MP3...`);
            const tempWav = filePath + '.tmp.wav';
            await fs.promises.writeFile(tempWav, buffer);
            try {
                await execAsync(`ffmpeg -y -v error -i "${tempWav}" -codec:a libmp3lame -qscale:a 2 "${filePath}"`);
            } finally {
                try { fs.unlinkSync(tempWav); } catch (_) {}
            }
        }

        // 3. ffprobe-validate the final file — disabled because it causes false positives on valid VBR MP3s
        // let probeValid = false;
        // try {
        //     await execAsync(`ffprobe -v error -show_format "${filePath}"`);
        //     probeValid = true;
        // } catch (_) { probeValid = false; }
        // if (!probeValid) {
        //     addJobLog(`[Audio Guard] ffprobe validation FAILED for ${path.basename(filePath)} (corrupt/malformed header). Overwriting with 2s silent fallback...`);
        //     const silentBuffer = getSilentWavBuffer(2);
        //     await saveAudioAsMP3(silentBuffer, filePath);
        // }
        return true;
    } catch (e) {
        addJobLog(`⚠️ Error verifying audio format for ${path.basename(filePath)}: ${e.message}`);
        return false;
    }
}

const MOCK_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAACXBIWXMAAAABAAAAAQBPJcTWAAAAe0lEQVR4nNXOMQ0AAAjAsJHMv2ZEcJBVQYc4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4vwNXCyFoAP6hilguAAAAAElFTkSuQmCC";

const server = http.createServer((req, res) => {
    const origin = req.headers.origin || '*';
    const safeOrigin = origin; // Allow all origins (e.g. Vercel production)
    
    const corsHeaders = {
        'Access-Control-Allow-Origin': safeOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    // Auto-inject CORS headers into every response safely
    const originalWriteHead = res.writeHead;
    res.writeHead = function(statusCode, headers) {
        const mergedHeaders = Object.assign({}, headers || {}, corsHeaders);
        return originalWriteHead.call(res, statusCode, mergedHeaders);
    };

    if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders);
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;

    // API Routes
    if (pathname === '/api/generation-status' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
        res.end(JSON.stringify(activeJob));
        return;
    }

    if (pathname === '/api/generate-script' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > MAX_BODY) {
                req.destroy();
                res.writeHead(413, { 'Content-Type': 'application/json', ...corsHeaders });
                res.end(JSON.stringify({ error: 'Request body too large.' }));
            }
        });
        req.on('end', () => {
            try {
                const params = JSON.parse(body);
                if (activeJob.status === 'running') {
                    jobQueue.push(params);
                    console.log(`[Queue] Pushed job to queue. Queue length: ${jobQueue.length}`);
                    res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
                    res.end(JSON.stringify({ success: true, message: 'Job queued', queueLength: jobQueue.length }));
                    return;
                }
                const { topicTheme, videoType, targetDuration, apiKey, model } = params;
                startBackendScriptGeneration(topicTheme, videoType, targetDuration, apiKey, model);
                res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
                res.end(JSON.stringify({ success: true, message: 'Script generation started' }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    if (pathname === '/api/regenerate-asset' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > MAX_BODY) {
                req.destroy();
                res.writeHead(413, { 'Content-Type': 'application/json', ...corsHeaders });
                res.end(JSON.stringify({ error: 'Request body too large.' }));
            }
        });
        req.on('end', async () => {
            try {
                const params = JSON.parse(body);
                const { sceneIndex, type, text, videoType, scriptTitle, apiKey, sceneDuration } = params;
                const config = readConfig();
                const targetDir = config.outputPath || path.join(__dirname, 'output');
                const imagesDir = path.join(targetDir, 'images');
                const audioDir = path.join(targetDir, 'audio');
                
                ensureDir(targetDir);
                
                if (type === 'image') {
                    ensureDir(imagesDir);
                    const indexStr = String(sceneIndex + 1).padStart(3, '0');
                    const imgPath = path.join(imagesDir, `scene_${indexStr}.png`);
                    let imgBuffer = null;
                    let imgGenerated = false;

                    if (true) {
                        try {
                            console.log(`[Regenerate] Replicate generating image for scene ${sceneIndex + 1}...`);
                            const falApiKey = readConfig().falApiKey || '';
                            const replicateApiKey = process.env.REPLICATE_API_KEY || falApiKey;
                            const payload = JSON.stringify({
                                input: {
                                    prompt: text,
                                    aspect_ratio: videoType === 'short' ? '9:16' : '16:9',
                                    output_format: "png"
                                }
                            });
                            const mockLog = (msg) => console.log(msg);
                            const imgUrl = await callReplicateWithRetry(payload, replicateApiKey, mockLog);
                            imgBuffer = await fetchImageBuffer(imgUrl);
                            imgGenerated = true;
                            console.log(`✓ [Regenerate] Replicate image completed.`);
                        } catch (err) {
                            console.log(`⚠️ [Regenerate] Replicate failed: ${err.message}.`);
                            throw new Error(`Image generation failed: ${err.message}`);
                        }
                    }

                    if (imgGenerated && imgBuffer) {
                        await fs.promises.writeFile(imgPath, imgBuffer);
                    }
                } else if (type === 'audio') {
                    ensureDir(audioDir);
                    const audioFileName = getAudioFileName(scriptTitle, sceneIndex);
                    const audioPath = path.join(audioDir, audioFileName);
                    
                    const spokenText = extractSpokenText(text);
                    const falApiKey = readConfig().falApiKey || '';
                    const replicateApiKey = process.env.REPLICATE_API_KEY || (readConfig().replicateApiKey) || falApiKey;
                    const elevenlabsApiKey = config.elevenlabsApiKey || '';
                    const mockLog = (msg) => console.log(msg);
                    let audioGenerated = false;

                    if (replicateApiKey && replicateApiKey.trim().length > 10 && spokenText) {
                        try {
                            console.log(`[Regenerate] Gemini TTS generating voiceover for scene ${sceneIndex + 1}...`);
                            const parsedVo = parseVoiceover(text);
                            const payload = JSON.stringify({
                                input: {
                                    text: parsedVo.text,
                                    voice: "Charon",
                                    prompt: parsedVo.prompt,
                                    language_code: "en-US"
                                }
                            });
                            const audioUrl = await callReplicateWithRetry(
                                payload, 
                                replicateApiKey.trim(), 
                                mockLog, 
                                "https://api.replicate.com/v1/models/google/gemini-3.1-flash-tts/predictions"
                            );
                            const audioBuffer = await downloadAudioFromUrl(audioUrl);
                            await saveAudioAsMP3(audioBuffer, audioPath);
                            console.log(`✓ [Regenerate] Gemini TTS voiceover saved.`);
                            audioGenerated = true;
                        } catch (cbErr) {
                            console.log(`⚠️ [Regenerate] Gemini TTS failed: ${cbErr.message}.`);
                        }
                    }

                    if (!audioGenerated) {
                        const fallbackDuration = Number(sceneDuration) > 0 ? Number(sceneDuration) : 2;
                        console.log(`⚠️ [Regenerate] Voiceover generation failed or no text. Saving silent fallback.`);
                        await saveAudioAsMP3(getSilentWavBuffer(fallbackDuration), audioPath);
                    }

                    if (spokenText) {
                        await compactSpeechAudio(audioPath);
                    }
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json', ...corsHeaders });
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
                res.writeHead(413, { 'Content-Type': 'application/json', ...corsHeaders });
                res.end(JSON.stringify({ error: 'Request body too large.' }));
            }
        });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                activeJob.script = data.script;
                writeLatestScript(data.script);
                res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json', ...corsHeaders });
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
        const config = readConfig();
        const safeConfig = {
            ...config,
            apiKey: config.apiKey ? '***' + config.apiKey.slice(-4) : '',
            geminiApiKey: config.geminiApiKey ? '***' + config.geminiApiKey.slice(-4) : '',
            elevenlabsApiKey: config.elevenlabsApiKey ? '***' + config.elevenlabsApiKey.slice(-4) : '',
            falApiKey: config.falApiKey ? '***' + config.falApiKey.slice(-4) : '',
            replicateApiKey: config.replicateApiKey ? '***' + config.replicateApiKey.slice(-4) : ''
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(safeConfig));
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

                // Prevent overwriting real keys with masked keys from the client
                const keysToSkip = ['apiKey', 'geminiApiKey', 'elevenlabsApiKey', 'falApiKey', 'replicateApiKey'];
                for (const key of keysToSkip) {
                    if (newConfig[key] && newConfig[key].startsWith('***')) {
                        delete newConfig[key];
                    }
                }

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
                if (!safeFilename || safeFilename !== filename) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid filename' }));
                    return;
                }

                const filePath = path.join(targetDir, safeFilename);
                if (!path.resolve(filePath).startsWith(path.resolve(targetDir))) {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Forbidden.' }));
                    return;
                }

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
                const model = providedModel || 'deepseek/deepseek-chat';
                
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
                const model = providedModel || 'deepseek/deepseek-chat';
                
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
            res.writeHead(200, { 
                'Content-Type': 'text/html',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
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
        const mediaExts = ['.mp4', '.mp3', '.wav'];
        if (mediaExts.includes(ext)) {
            const stat = fs.statSync(filePath);
            res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': stat.size });
            fs.createReadStream(filePath).pipe(res);
            return;
        }
        const isImmutable = filePath.includes('assets') && (ext === '.js' || ext === '.css');
        if (isImmutable) {
            res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' });
        } else {
            res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
        }
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
