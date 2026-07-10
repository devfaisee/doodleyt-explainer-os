import { Router } from 'express';
import { activeJob, jobQueue, writeLatestScript } from '../services/job.service.js';
import { startBackendScriptGeneration } from '../services/script-generation.service.js';
import { startBackendSynthesis } from '../services/synthesis.service.js';
import { startBackendAssembly } from '../services/assembly.service.js';
import { readConfig, getEffectiveApiKey } from '../utils/config.js';
import { callReplicateWithRetry, extractSpokenText, parseVoiceover } from '../services/media.service.js';
import { fetchImageBuffer, httpsGet } from '../utils/network.js';
import { callOpenRouter, repairJson } from '../services/llm.service.js';
import { getAudioFileName, saveAudioAsMP3, getSilentWavBuffer } from '../services/ffmpeg.service.js';
import { ensureDir } from '../utils/fileSystem.js';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

import { listScriptHistory } from '../services/history.service.js';


const probeAudioDurationSeconds = async (audioPath) => {
    try {
        const { stdout } = await execFileAsync('ffprobe', [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            audioPath
        ]);
        const duration = Number.parseFloat(stdout.trim());
        if (!Number.isFinite(duration) || duration <= 0.05) return null;
        return duration;
    } catch (_) {
        return null;
    }
};

const compactSpeechAudio = async (audioPath) => {
    const compactPath = `${audioPath}.compact.mp3`;
    try {
        const beforeDuration = await probeAudioDurationSeconds(audioPath);
        await execFileAsync('ffmpeg', [
            '-nostdin',
            '-y',
            '-v', 'error',
            '-i', audioPath,
            '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse',
            '-c:a', 'libmp3lame',
            '-q:a', '3',
            compactPath
        ]);
        const afterDuration = await probeAudioDurationSeconds(compactPath);
        if (afterDuration && (!beforeDuration || afterDuration >= 0.35)) {
            await fs.promises.rename(compactPath, audioPath);
            return { beforeDuration, afterDuration };
        }
    } catch (_) {
        // Keep original file when compaction fails.
    } finally {
        try { fs.unlinkSync(compactPath); } catch (_) {}
    }
    return null;
};

const router = Router();

router.get('/generation-status', (req, res) => {
    res.json(activeJob);
});

router.post('/generate-script', (req, res) => {
    try {
        if (activeJob.status === 'running') {
            if (jobQueue.length >= 5) {
                return res.status(429).json({ error: 'Job queue is full. Please try again later.' });
            }
            jobQueue.push(req.body);
            console.log(`[Queue] Pushed job to queue. Queue length: ${jobQueue.length}`);
            return res.json({ success: true, message: 'Job queued', queueLength: jobQueue.length });
        }
        const { topicTheme, videoType, targetDuration, apiKey, model } = req.body;
        startBackendScriptGeneration(topicTheme, videoType, targetDuration, apiKey, model);
        res.json({ success: true, message: 'Script generation started' });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

router.post('/regenerate-asset', async (req, res) => {
    try {
        const { sceneIndex, type, text, videoType, scriptTitle, apiKey, sceneDuration } = req.body;
        const config = readConfig();
        const targetDir = config.outputPath || path.join(process.cwd(), 'output');
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
                    const falApiKey = config.falApiKey || '';
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
            const falApiKey = config.falApiKey || '';
            const replicateApiKey = process.env.REPLICATE_API_KEY || config.replicateApiKey || falApiKey;
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
                            // prompt removed to bypass Gemini's aggressive false-positive safety filters
                            language_code: "en-US"
                        }
                    });
                    const audioUrl = await callReplicateWithRetry(
                        payload, 
                        replicateApiKey.trim(), 
                        mockLog, 
                        "https://api.replicate.com/v1/models/google/gemini-3.1-flash-tts/predictions"
                    );
                    const audioBuffer = await httpsGet(audioUrl);
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
        
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/save-active-script', (req, res) => {
    try {
        const data = req.body;
        activeJob.script = data.script;
        writeLatestScript(data.script);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/cancel-generation', (req, res) => {
    activeJob.status = 'idle';
    activeJob.logs.push(`[${new Date().toLocaleTimeString()}] 🛑 Generation cancelled by user.`);
    res.json({ success: true });
});

router.post('/synthesize-assets', (req, res) => {
    if (activeJob.status === 'running') {
        return res.status(409).json({ error: 'A background job is already in progress.' });
    }
    try {
        const { script, apiKey, falApiKey, elevenlabsApiKey, geminiApiKey, outputPath, synthesisMode } = req.body;
        if (!script) throw new Error("Script data is required");
        
        startBackendSynthesis(script, falApiKey, elevenlabsApiKey, outputPath, apiKey, geminiApiKey, synthesisMode || 'audio_and_images');
        
        res.json({ success: true, message: 'Asset synthesis started' });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

router.post('/assemble-video', (req, res) => {
    if (activeJob.status === 'running') {
        return res.status(409).json({ error: 'A background job is already in progress.' });
    }
    try {
        const { script, outputPath } = req.body;
        if (!script) throw new Error("Script data is required");
        
        startBackendAssembly(script, outputPath);
        
        res.json({ success: true, message: 'Video compilation started' });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

router.post('/brainstorm-topics', async (req, res) => {
    try {
        const { apiKey: providedApiKey, model: providedModel, inventNiches } = req.body;
        const apiKey = getEffectiveApiKey(providedApiKey);
        
        let primaryModel = providedModel || 'deepseek/deepseek-v4-flash';
        // Upgrade to a flagship reasoning/creative model for brainstorming to get elite quality ideas
        if (primaryModel.includes('flash') || primaryModel === 'deepseek/deepseek-v4-flash') {
            primaryModel = 'anthropic/claude-sonnet-5';
        }

        // Load existing script titles to exclude them from the brainstorm prompt
        let existingTitles = [];
        try {
            const scriptsList = await listScriptHistory();
            existingTitles = (scriptsList || []).map(s => s.title).filter(Boolean);
        } catch (historyErr) {
            console.error("Failed to load script history for exclusions:", historyErr);
        }

        const excludeSection = existingTitles.length > 0
            ? `\n\nEXCLUDED TITLES (Already generated / used - DO NOT repeat or suggest similar concepts to these under any circumstances):\n` + existingTitles.slice(0, 100).map(t => `- "${t}"`).join('\n')
            : '';
        
        const systemPrompt = `MASTER IDEA DISCOVERY ENGINE (2026)

You are an elite YouTube Content Strategist, Trend Researcher, Internet Culture Analyst, Consumer Psychologist, and Viral Content Architect.
Your only objective is discovering the highest-potential video ideas before everyone else.
You never generate generic ideas. Instead, you search for hidden opportunities by combining psychology, history, science, technology, internet discussions, search behavior, trends, evergreen demand, curiosity gaps, and human emotions.

Every idea must satisfy at least one of these goals:
- Make people say "I never thought about that."
- Reveal something hidden.
- Answer a question people didn't know they had.
- Challenge a common belief.
- Create a powerful curiosity gap.
- Trigger strong emotions.
- Be memorable enough that someone wants to share it.

THINKING PROCESS:
First silently analyze: Current internet discussions, Search demand, Evergreen demand, Emerging technologies, Human psychology, Historical events, Scientific discoveries, Social behavior, Common myths, Internet mysteries, Paradoxes, Counterintuitive facts.
Look for: Questions repeatedly asked, things everyone misunderstands, problems nobody explains well, ideas beginning to trend, old ideas becoming relevant again.

IDEA SOURCES:
Psychology, Human behavior, Neuroscience, History, Technology, AI, Economics, Internet culture, Mysteries, Space, Nature, Evolution, Language, Relationships, Addiction, Memory, Habits, Sleep, Famous people, Forgotten inventions, Ancient civilizations, Crime, Consumer psychology.

DISCOVERY METHODS - Search for:
"What if...", "Why...", "How...", "The hidden reason...", "The real story...", "What nobody tells you...", "The psychology of...", "The mistake everyone makes...", "How your brain...", "The dark side of...", "The forgotten...", "The biggest lie..."

REJECT IDEAS IF:
They are obvious, oversaturated, require celebrity gossip, depend only on today's news, have no curiosity, are repetitive, teach nothing new, or feel AI-generated.

SCORE EVERY IDEA (Mentally rate out of 10):
Novelty, Curiosity, Click Potential, Evergreen Value, Shareability, Retention Potential, Visual Potential, Search Demand, Emotional Impact, Discussion Potential.
Only output ideas scoring 85/100 or higher.

IMPROVE EACH IDEA:
Before outputting, ask: Can it become more surprising? More emotional? More visual? More timeless? More unique? Can it create stronger curiosity? If yes, improve it.

VIRAL TITLE LAWS (Strictly Enforced):
- Length: 5 to 9 words maximum.
- Curiosity Gap: Withhold the core resolution or punchline.
- Formatting: Sentence case. No emojis. No ending punctuation. No clickbait questions (do not start with "Is this the...?").`;

        let userPrompt = `Generate exactly 10 highly-researched, elite video ideas following the Master Idea Discovery Engine framework.\n`;
        if (inventNiches) {
            userPrompt += `Instead of using standard categories, invent 10 completely original, bizarre, fascinating, and unexplored educational niches (e.g. "Digital Archaeology", "Micro-Biological Warfare", "Psychology of Geometry", etc.).\nFor each of your 10 invented niches, provide exactly one top-tier video idea.\n\n`;
        } else {
            userPrompt += `Generate one top-tier video idea for each of these 10 categories (or find a much better intersection of disciplines):
1. Evolutionary Anthropology & Ancient History
2. Behavioral Psychology & Social Experiments
3. Biological Anomalies & Human Body Mysteries
4. Existential, Cognitive & Scientific Mysteries
5. Archaeological Mysteries & Lost Civilizations
6. Survival Psychology & Extreme Environment Biology
7. Bizarre Historical Events & Mass Hysteria
8. Military & Technological Blunders
9. Existential Space & Cosmic Anomalies
10. Psychology of Beliefs & Secret Societies\n\n`;
        }

        userPrompt += `${excludeSection}

Format your response strictly as a JSON object with this exact schema:
{
  "topics": [
    { 
      "id": 1, 
      "title": "[Title 5-9 words]", 
      "cat": "[Category/Niche]", 
      "curiosity": 9.8, 
      "novelty": 9.5, 
      "relatability": 9.2, 
      "hook": "[One-line hook explaining the specific bizarre fact behind the video]" 
    },
    ...
  ]
}`;
        
        let response;
        try {
            response = await callOpenRouter(systemPrompt, userPrompt, apiKey, primaryModel, true);
        } catch (err) {
            console.warn(`Brainstorm failed with primary model ${primaryModel}, falling back...`, err);
            const fallbackModel = providedModel || 'deepseek/deepseek-v4-flash';
            response = await callOpenRouter(systemPrompt, userPrompt, apiKey, fallbackModel, true);
        }
        
        let raw = response;
        const parsedData = repairJson(raw);
        if (!parsedData || !parsedData.topics) {
            throw new Error("Brainstorm failed to return valid JSON array of topics.");
        }
        
        res.json(parsedData);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/load-brainstorm', async (req, res) => {
    const config = readConfig();
    const targetDir = config.outputPath || path.join(process.cwd(), 'output');
    const brainstormPath = path.join(targetDir, 'brainstormed_ideas.json');
    try {
        if (fs.existsSync(brainstormPath)) {
            const data = fs.readFileSync(brainstormPath, 'utf8');
            res.json(JSON.parse(data));
        } else {
            res.json({ topics: [] });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/save-brainstorm', async (req, res) => {
    const config = readConfig();
    const targetDir = config.outputPath || path.join(process.cwd(), 'output');
    const brainstormPath = path.join(targetDir, 'brainstormed_ideas.json');
    try {
        ensureDir(targetDir);
        fs.writeFileSync(brainstormPath, JSON.stringify(req.body, null, 2), 'utf8');
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/fix-prompt', async (req, res) => {
    try {
        const { prompt, characters: providedChars, apiKey: providedApiKey, model: providedModel } = req.body;
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
        res.json({ correctedText: correctedText.trim() });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
