import { Router } from 'express';
import { activeJob, jobQueue, writeLatestScript } from '../services/job.service.js';
import { startBackendScriptGeneration } from '../services/script-generation.service.js';
import { startBackendSynthesis } from '../services/synthesis.service.js';
import { startBackendAssembly } from '../services/assembly.service.js';
import { readConfig, getEffectiveApiKey } from '../utils/config.js';
import { callReplicateWithRetry, extractSpokenText, parseVoiceover } from '../services/media.service.js';
import { fetchImageBuffer, httpsGet } from '../utils/network.js';
import { callOpenRouter } from '../services/llm.service.js';
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
                            prompt: parsedVo.prompt || "A highly professional, calm, and grounded documentary narrator. NO dramatic overacting.",
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
        const { apiKey: providedApiKey, model: providedModel } = req.body;
        const apiKey = getEffectiveApiKey(providedApiKey);
        
        let primaryModel = providedModel || 'deepseek/deepseek-v4-flash';
        // Upgrade to a flagship reasoning/creative model for brainstorming to get elite quality ideas
        if (primaryModel.includes('flash') || primaryModel === 'deepseek/deepseek-v4-flash') {
            primaryModel = 'google/gemini-2.5-flash';
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
        
        const systemPrompt = `You are a world-class YouTube strategist, niche researcher, and head of ideation for the channel "Doodle Theory".
Your goal is to design topics that strike a PERFECT balance between:
1. HIGH-VOLUME EVERGREEN SEARCH: Topics centered on popular keywords that people actively search for year after year (e.g. ancient civilizations, deep space anomalies, human biology paradoxes, behavioral psychology).
2. HIGH-CTR CURIOSITY GAPS: Framing those popular topics with an irresistible, mysterious, and reality-bending angle (so browse feed viewers click instantly).

You must strictly avoid ideas that are so bizarre or obscure that no one would ever search for them. Instead, take a popular, search-friendly topic and give it a fascinating, counter-intuitive twist.

PSYCHOLOGICAL TITLE FORMULAS (Use these to construct titles dynamically; do NOT repeat the specific subjects like teeth, bones, or temples):
1. THE ANOMALY METAPHOR: [Specific, Obscure Feature/Event] That [Subverts Modern Expectations]
   - Focus: A counter-intuitive discovery about human history or biology.
2. THE ISOLATED PSYCHOLOGY: Inside the [Extreme/Obscure Environment/Condition] That [Forces a Weird Human Reaction]
   - Focus: A psychological state or social experiment.
3. THE HIDDEN PARADOX: The [Bizarre/Lesser-Known Trait] That [Causes a Massive Counter-Intuitive Benefit/Cost]
   - Focus: Biological anomalies or physical mysteries.
4. THE CHAOTIC CASCADE: The [Obscure/Tiny Catalyst] That [Caused a Historic Catastrophic Event]
   - Focus: Historical blunders or technology failures.
5. THE DISSOCIATED ENIGMA: Why Ancient Builders/People [Performed a Bizarre, Seemingly Illogical Action]
   - Focus: Archaeology and lost civilizations.`;

        const userPrompt = `Generate exactly 10 fresh, high-click, curiosity-driven viral video topics for 'Doodle Theory'.
You MUST generate exactly one topic for each of these 10 core categories:
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
- Length: 5 to 9 words maximum.
- Curiosity Gap: Withhold the core resolution or punchline. Make the viewer think "Wait, what does that mean?"
- Formatting: Sentence case. No emojis. No ending punctuation. No clickbait questions (do not start with "Is this the...?").
- Direct and Grounded: Frame the title as a provocative, undeniable statement or direct query.
${excludeSection}

For each category, return the brainstormed topic metadata.
Format your response strictly as a JSON object:
{
  "topics": [
    { "id": 1, "title": "[Title 1]", "cat": "[Category 1]", "curiosity": 9.8, "novelty": 9.5, "relatability": 9.2, "hook": "[1 sentence hook explaining the specific bizarre fact behind the video]" },
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
        const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fenceMatch) raw = fenceMatch[1].trim();
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Brainstorm failed to return JSON.");
        
        res.json(JSON.parse(jsonMatch[0]));
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
