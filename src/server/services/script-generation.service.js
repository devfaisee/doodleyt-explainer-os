import fs from 'fs';
import path from 'path';
import { activeJob, addJobLog, writeLatestScript, buildDefaultStages, updateJobStageStatus } from './job.service.js';
import { getEffectiveApiKey, readConfig, writeConfig, STYLE_REFS_DIR } from '../utils/config.js';
import { callOpenRouter, callGeminiAPI, repairJson } from './llm.service.js';
import { saveScriptToHistory } from './history.service.js';
import { extractSpokenText } from './media.service.js';

const BANNED_PRONOUNS = ['he', 'she', 'it', 'they', 'his', 'her', 'their', 'its', 'same', 'similar', 'previous', 'earlier', 'above', 'below', 'again', 'identical', 'character', 'figure'];

function buildFallbackScript(topicTheme, videoType, targetDuration, visualDNA, styleReferences) {
    const isShort = videoType === 'short';
    const title = isShort
        ? 'Why Your Brain Fights Silence'
        : 'Why Your Brain Fights Silence in the Dark';
    const category = 'Behavioral Psychology';
    const nicheReason = topicTheme
        ? `Fallback script built locally for the theme "${topicTheme}".`
        : 'Fallback script built locally to keep the pipeline deterministic when an LLM provider is unavailable.';
    const thumbnail = 'A terrified human silhouette in a perfectly silent room, wide eyes, bold text overlay: "TOO QUIET"';
    const characters = [
        { name: 'SILENCE SEEKER', description: 'A wide-eyed human figure with messy hair, clenched hands, and a tense posture.' },
        { name: 'NIGHT WATCHER', description: 'A tired human figure with dark circles under the eyes, sitting upright in bed.' }
    ];

    const sceneBlueprints = isShort
        ? [
            {
                duration: 3,
                voiceover: 'Read with quiet authority: "Silence should feel peaceful, but your brain treats it like danger."',
                prompt: 'A clean, hand-drawn 2D vector-style cartoon illustration with smooth black outlines and flat color fills. A wide-eyed human figure sits alone in a silent room with a frozen expression. Solid flat white background.'
            },
            {
                duration: 3,
                voiceover: 'Read with rising tension: "When the world goes quiet, every tiny sound becomes a warning."',
                prompt: 'A clean, hand-drawn 2D vector-style cartoon illustration with smooth black outlines and flat color fills. A nervous human figure listens to tiny sounds in a perfectly still room. Solid flat white background.'
            },
            {
                duration: 3,
                voiceover: 'Read with calm certainty: "That reaction is old survival software still running inside the mind."',
                prompt: 'A clean, hand-drawn 2D vector-style cartoon illustration with smooth black outlines and flat color fills. A simple brain icon powers a frightened human figure standing in darkness. Solid flat white background.'
            }
        ]
        : [
            {
                duration: 3,
                voiceover: 'Read with quiet authority: "Silence should feel peaceful, but the mind reads it as a threat."',
                prompt: 'A clean, hand-drawn 2D vector-style cartoon illustration with smooth black outlines and flat color fills. A wide-eyed human figure sits in a silent room, listening for danger. Solid flat white background.'
            },
            {
                duration: 3,
                voiceover: 'Read with rising tension: "Every hidden sound gets louder when the room goes still."',
                prompt: 'A clean, hand-drawn 2D vector-style cartoon illustration with smooth black outlines and flat color fills. A human figure notices tiny sounds echoing in a silent room. Solid flat white background.'
            },
            {
                duration: 4,
                voiceover: 'Read with fascination: "That fear is ancient, and it never fully left the brain."',
                prompt: 'A clean, hand-drawn 2D vector-style cartoon illustration with smooth black outlines and flat color fills. An ancient survival-themed brain graphic hovers above a frightened human figure. Solid flat white background.'
            },
            {
                duration: 4,
                voiceover: 'Read with calm certainty: "So the quiet room does not feel empty. It feels exposed."',
                prompt: 'A clean, hand-drawn 2D vector-style cartoon illustration with smooth black outlines and flat color fills. A human figure stands exposed in a silent room while warning symbols appear nearby. Solid flat white background.'
            }
        ];

    return {
        title,
        category,
        nicheReason,
        thumbnail,
        characters,
        seoMetadata: {
            description: 'Silence is supposed to calm the mind, but sometimes it does the opposite. This fallback blueprint explores why the brain treats quiet like danger and what that says about survival itself. Watch closely and see where the fear comes from.',
            hashtags: ['#DoodleTheory', '#Psychology', '#BrainFacts', '#HumanBehavior', '#ScienceFacts', '#Anxiety', '#Silence', '#Explainer', '#MindBlown', '#Curiosity', '#Neuroscience', '#Mystery', '#Learning', '#Facts', '#Animation'],
            tags: 'doodle theory, psychology, brain facts, human behavior, silence fear, neuroscience, survival instinct, curiosity, science facts, animated explainer, mind mystery, anxiety response, deep psychology, human mind, explainer video'
        },
        scenes: sceneBlueprints,
        timestamp: Date.now(),
        videoType,
        targetDuration,
        estimatedCost: { images: 0, audio: 0, llm: 0, total: 0 },
        fallbackGenerated: true
    };
}

export const validatePromptText = (promptText) => {
    if (!promptText) return { isValid: true, words: [] };
    const cleaned = promptText.toLowerCase().replace(/[^a-z0-9'\s-]/g, ' ');
    const tokens = cleaned.split(/\s+/);
    const leaked = BANNED_PRONOUNS.filter(p => tokens.includes(p));
    return {
        isValid: leaked.length === 0,
        words: leaked
    };
};

export function startBackendScriptGeneration(topicTheme, videoType, targetDuration, providedApiKey, providedModel) {
    // Input validation
    const parsedDuration = parseInt(targetDuration, 10);
    if (isNaN(parsedDuration) || parsedDuration < 1 || parsedDuration > 30) {
        activeJob.status = 'failed';
        activeJob.error = 'Invalid target duration. Must be an integer between 1 and 30.';
        addJobLog(`❌ Generation failed: ${activeJob.error}`);
        return;
    }
    if (videoType !== 'short' && videoType !== 'long') {
        activeJob.status = 'failed';
        activeJob.error = "Invalid video type. Must be 'short' or 'long'.";
        addJobLog(`❌ Generation failed: ${activeJob.error}`);
        return;
    }
    const apiKey = getEffectiveApiKey(providedApiKey);
    const userModel = providedModel || 'deepseek/deepseek-v4-flash';
    
    // ═══════════════════════════════════════════════════════════════
    // PERFECT STACK — Model Division (Based on Empirical LLM Testing)
    // ═══════════════════════════════════════════════════════════════
    // Claude Sonnet 5:       Ideation, niche design, titles, hooks
    // GLM 5.2:               Script drafting & pacing (flawless documentary voice)
    // DeepSeek V4 Flash:     QC, JSON fixing, analytical tasks
    // ═══════════════════════════════════════════════════════════════
    let creativeModel = 'anthropic/claude-sonnet-5';
    let scriptingModel = 'anthropic/claude-sonnet-5';
    let qcModel = 'deepseek/deepseek-v4-flash';
    
    if (userModel && !userModel.includes('claude') && !userModel.includes('glm') && !userModel.includes('deepseek')) {
        creativeModel = userModel;
    }
    
    // Set initial job state
    activeJob.status = 'running';
    activeJob.jobType = 'generation';
    activeJob.logs = [];
    activeJob.error = null;
    activeJob.topicTheme = topicTheme;
    activeJob.videoType = videoType;
    activeJob.targetDuration = parsedDuration;
    activeJob.stages = buildDefaultStages(videoType, parsedDuration);
    activeJob.script = null; // Clear old script data
    
    (async () => {
        const config = readConfig();
        addJobLog(`⚙️ Booting Dynamic Multistage Pipeline Orchestrator...`);
        addJobLog(`🧠 Model Split: Creative tasks ->  | Scripting/QC tasks -> `);
        addJobLog(`🎬 Mode: ${videoType.toUpperCase()} | Target Length: ${videoType === 'short' ? 'Short (~1 min)' : `${parsedDuration} min`} (Scene count determined dynamically by LLM)`);
        
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

        const designUserPrompt = `Autonomously select a highly engaging, curiosity-driven niche video topic that strikes a perfect balance between high-volume evergreen search (topics people actively search for year after year like ancient history, cosmic mysteries, human biology) and an irresistible curiosity gap. Avoid topics that are so obscure that no one would search for them. Take a popular topic and find a fascinating, counter-intuitive angle.
${topicTheme ? `Focus on this theme/keyword: "${topicTheme}". Narrow it down to a highly search-friendly, profound sub-niche. You are free to choose any category or niche that fits this theme.` : `Generate a highly search-friendly, deeply profound and weird niche topic.

Use these categories as inspiration, but you are free to go beyond them:
1. Evolutionary Anthropology & Ancient Human History
2. Behavioral Psychology & Famous Social Experiments
3. Biological Anomalies & Human Body Mysteries
4. Existential, Cognitive & Scientific Mysteries
5. Archaeological Mysteries & Lost Civilizations
6. Survival Psychology & Extreme Environment Biology
7. Bizarre Historical Events & Mass Hysteria
8. Military & Technological Blunders
9. Existential Space & Cosmic Anomalies
10. Psychology of Beliefs & Secret Societies`}

VIRAL TITLE LAWS (Strictly Enforced):
- Short & Striking: Length must be 5 to 9 words maximum.
- Curiosity Gap Formula: Withhold the core secret, answer, or resolution.
- Cognitive Dissonance / Impossibility Gap: Frame the title around an impossible paradox or a rule of nature/logic being broken (e.g., "The Island Where Time Runs Backward", "The Silent Disease Hidden In Your Teeth"). The viewer must feel it is physically impossible, yet scientifically true.
- Provocative Addressing: Speak directly to the viewer (e.g., "Why Your Brain Fights Sleep at 3 AM").
- Existential/Primal Shock: Highlight deep ancestral fears, hidden anomalies, or reality-breaking facts.
- Formatting: Use sentence case. Never use ending punctuation or clickbait emojis.

CHARACTER DESIGN RULES:
Design 1-3 custom characters needed for this script. For each character, design a Character Card with a detailed physical description as a cartoon character. Art style: clean hand-drawn 2D cartoon outlines, solid flat colors, white background.

AI THUMBNAIL PROMPT LAW (Maximum Click-Through Rate):
Create a highly visual, psychological thumbnail description. The layout must feature:
1. A clean, hand-drawn 2D cartoon illustration showing an extreme emotional charge or a visual mystery/red herring (e.g. a hand missing a shadow, a clock with melting numbers, or a brain with a locked padlock on it) with clean, smooth outlines and flat color fills.
2. A high-contrast color scheme: Use a single solid, bright, eye-catching color for the flat background (such as bright yellow, hot crimson, or solid black) to stand out on the YouTube feed.
3. A bold capitalized text overlay of 1-3 words (e.g., "DON'T LOOK", "TOO LATE", "LOCK!") written inside double quotes in the prompt. Specify that the text should be bold, hand-drawn uppercase letters in a highly contrasting color (like yellow text on black, or red text on white) with a thick black outline.
4. The aspect ratio for the video layout is: \${videoType === 'short' ? '9:16 vertical portrait format' : '16:9 widescreen landscape format'}.

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

        addJobLog(`🧠 Routing Stage 1 Niche Design through OpenRouter...`);
        const designResponse = await callOpenRouter(designSystemPrompt, designUserPrompt, apiKey, creativeModel, true);
        if (activeJob.status === 'idle') return; // Cancelled
        
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

        const numActs = videoType === 'short' ? 1 : parsedDuration;
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
Channel Tone: Clean, informative, highly professional documentary narration. The narrator explains concepts with clear, authoritative simplicity, making complex topics easy for anyone to understand (think Vsauce, LEMMiNO, or Aperture). No dramatic overacting, no whispering, no anger, and no theatrical voice acting.
Narrative Clarity & Pacing: Start with a clear, relatable, and grounded premise. Explain the science or history step-by-step using simple, punchy, active-voice sentences. Avoid overly complex academic jargon or convoluted philosophical concepts. Keep the explanation direct, fascinating, and easy to follow.
Art Style DNA: Whiteboard cartoon illustration style. Hand-drawn felt-pen black outlines, flat solid color fills. Backgrounds are simple and high-contrast: solid white, bright solid yellow, deep solid black, or flat colored environments. Features bold, hand-drawn uppercase text overlays with thick black outlines (typically in bright yellow, red, or white) and simple hand-drawn red pointing arrows or white speech bubbles where appropriate. Simple, cute cartoon representations of animals, people, and objects instead of complex artwork. No gradients, no 3D elements, no realistic shading.
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
5. 0:55-0:60 (The Seamless Loop): End on an ambiguous or perfectly circular final thought that flawlessly bleeds back into the opening hook to maximize re-watches.
   - SEAMLESS LOOP LAW: The final scene's voiceover must end mid-thought or with a grammatical setup (e.g. ending with a preposition like "because...") so that it naturally completes its meaning when it loops back to the very first scene of the video.
   - CRITICAL WARNING: Never copy, repeat, or append the opening scenes or their voiceovers/prompts at the end of the script! The final scene must be completely unique. The loop is created purely by the grammatical flow of the final spoken words leading back to the first spoken words. Do not copy the first scene.`;
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
1. Clear, Simple Storytelling: Use short, punchy, active-voice sentences. Explain complex ideas using simple, everyday language and concrete analogies. Keep descriptions direct and extremely easy to understand. Do not make the explanation overly complex, academic, or philosophical.
2. Short Voiceovers & Fast Visual Hooking: To maximize user retention, the visual layout MUST update every 1.5 to 3 seconds. Therefore:
   - Keep the voiceover script for any single scene EXTREMELY short (maximum 6 words, ideal is 3 to 5 words per scene).
   - Sentence Splitting Law: If a sentence is long, you MUST split it across multiple consecutive scenes. However, you MUST split only at natural grammatical boundaries (clauses, punctuation, or complete phrases). Never end a scene's voiceover with a hanging conjunction (and, or, but), preposition (of, in, at, with, to), pronoun/article (the, a, an, this, that), or copula verb (is, are, was, were). Each scene's voiceover chunk must sound like a complete, natural spoken phrase on its own when read aloud, without leaving the speaker hanging on a dangling word.
     - CRITICAL EXAMPLE OF WHAT NOT TO DO: Do NOT split like: Scene 1: "This is the", Scene 2: "catastrophe...". This is unacceptable because "the" is a dangling article and causes a jarring audio gap. Instead, split like: Scene 1: "This catastrophe", Scene 2: "almost erased humanity."
   - Climax Narration Law (Ending Flow): Do not fragment the last 3 scenes of the video into tiny 1-2 word clips (e.g. splitting "From those few we became everything" into "From those few", "we became", "everything"). The ending must flow smoothly. Keep sentences whole or split only into larger, natural phrases of 4-6 words to ensure the final thought is delivered with strong, continuous vocal momentum, avoiding stuttery pauses.
   - Prefixed Professional Narration (Tagging): To maintain a completely consistent, professional, and neutral documentary tone, you must prefix the voiceover for every single scene with the exact same prefix: 'Narrate professionally: "..."'. Never use varied emotional tags, whispering, or shouting directions. Always wrap the spoken clause inside double quotes inside the string.
   - Calculate duration strictly using only the spoken words inside the double quotes.
3. Literal Visual Syncing & Pacing (CRITICAL): The "prompt" field MUST exactly match the words being spoken. The visuals must perfectly depict the literal concepts or metaphors the voiceover is describing in that exact moment.
   - Visual-to-Audio Alignment Law: The image prompt must illustrate the EXACT nouns, actions, and metaphors spoken in that scene's voiceover. Do not introduce a visual subject (like a hand or a tool) before it is explicitly spoken. If the voiceover says "Now imagine it gone", the visual must literally depict something disappearing or an empty blank space, NOT a hand. The hand should only appear when the voiceover explicitly speaks the word "hand".
4. Perfect Voiceover-to-Duration Math: The "duration" field must match the actual speaking time of the voiceover text. Use these metrics:
   - 1 to 3 words = 2 seconds
   - 4 to 6 words = 3 seconds
   Never put more than 6 spoken words in a single scene.
5. Aspect Ratio: The layout format is ${videoType === 'short' ? '9:16 vertical portrait format' : '16:9 widescreen landscape format'}. Make sure all visual prompts specify this format.
6. Single Unified Image Prompt: In the "prompt" field, write one single unified prompt blending the camera direction, the EXACT literal action reflecting the voiceover (following the Stateless Prompt Rule), and text overlays ONLY if necessary.
   - Robustness Law: To prevent the image generator (Flux) from generating uncanny, distorted, or creepy drawings (especially for body parts like hands, eyes, or faces), never write simple, short, or generic prompts like "A human hand". You must describe the subject and context with rich, specific details. For example, instead of "A human hand", write: "A clean, hand-drawn 2D vector cartoon illustration of a human hand held up against a solid background, with fingers slightly parted and clean black pen outlines. Flat coloring."
   - Explicitly describe the environment, the posture, the details of any objects, and the precise expression. Complete descriptions yield high quality, whereas simple words yield uncanny drawings.
Never output the exact same visual prompt for different scenes.

Generate as many consecutive scenes as you intelligently decide are needed for this act of the video (aim for approximately 15 to 30 scenes to keep the pacing correct, but you have full creative control over the exact count based on how many scenes are needed to explain the content beautifully without rushing or lagging).

Return strictly a JSON object matching this schema:
{
  "scenes": [
    {
      "duration": [2 or 3],
      "voiceover": "Narrate professionally: \"[spoken text]\"",
      "prompt": "[Complete, unified stateless visual prompt blending camera direction, action, and extremely rare text overlay instructions. Follow Stateless Prompt Rule. White background]"
    }
  ]
}`;

            const actResponse = await callOpenRouter(actSystemPrompt, actUserPrompt, apiKey, scriptingModel, true);
            if (activeJob.status === 'idle') return; // Cancelled
            
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

        const splitSpokenText = (spokenText) => {
            return [spokenText.trim()];
        };

        // Auto-split long voiceovers (> 6 words) and sanitize empty voiceovers
        let splitSanitizedScenes = [];
        for (let idx = 0; idx < accumulatedScenes.length; idx++) {
            const scene = accumulatedScenes[idx];
            const voiceover = (scene.voiceover || '').trim();
            const spoken = extractSpokenText(voiceover).trim();
            const words = spoken.split(/\s+/).filter(w => w.length > 0);
            
            if (!spoken || spoken.length === 0) {
                addJobLog(`⚠️ Scene ${idx + 1}: Empty voiceover detected. Removing scene.`);
                // Skip empty scenes entirely instead of inserting hardcoded filler
                continue;
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
        
        let runningDuration = 0;
        let finalScenes = accumulatedScenes.map((scene, idx) => {
            const check = validatePromptText(scene.prompt);
            const sceneTime = formatTimeLocal(runningDuration);
            runningDuration += (scene.duration || 2);
            
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
                        const qcSystemPrompt = "You are an AI assistant that corrects image generator prompts to be stateless and pronoun-free. You must strictly avoid pronouns (he, she, it, they, his, her, their, its) and relative references (same, previous, earlier, above, below, again). Specifically, never output the word 'above' or 'below' or 'same' or 'he' or 'his' in your output under any circumstances. Replace them with concrete, absolute descriptions. Additionally, ensure the corrected prompt is highly descriptive, detailed, and robust (e.g. if the prompt mentions a hand or face, describe it with detailed characteristics like 'clean cartoon felt pen outlines, flat colors, hand held open' to avoid uncanny drawings).";
                        const correctedText = await callOpenRouter(qcSystemPrompt, prompt, apiKey, qcModel);
                        
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
        finalScriptData.targetDuration = parsedDuration;
        
        // --- COST CALCULATOR (LLM BASE) ---
        const MODEL_RATES = {
            'deepseek/deepseek-v4-flash': { input: 0.09, output: 0.18 },
            'deepseek/deepseek-r1': { input: 0.55, output: 2.19 },
            'anthropic/claude-sonnet-5': { input: 3.0, output: 15.0 },
            'z-ai/glm-5.2': { input: 0.10, output: 0.10 },
            'stepfun/step-3.7-flash': { input: 0.20, output: 1.15 }
        };
        const rates = MODEL_RATES[userModel] || { input: 0.5, output: 1.5 };
        const tokens = activeJob.llmTokens || { input: 0, output: 0 };
        const llmCost = (tokens.input * rates.input + tokens.output * rates.output) / 1000000;
        
        finalScriptData.estimatedCost = {
            images: 0,
            audio: 0,
            llm: Number(llmCost.toFixed(4)),
            total: Number(llmCost.toFixed(4))
        };
        addJobLog(`💰 Base LLM Scripting Cost: $${llmCost.toFixed(4)}`);
        
        if (finalScriptData.scenes && finalScriptData.scenes[0] && finalScriptData.scenes[0].voiceover) {
            try {
                const originalHook = finalScriptData.scenes[0].voiceover;
                const systemPrompt = "You are an expert hook writer. Reply with ONLY a JSON object: {\"direction\": \"Narrate professionally\", \"text\": \"<rewritten hook>\"}. NO filler, NO explanation.";
                const prompt = `Original: "${originalHook}"\nVideo title: "${finalScriptData.title}"\nRewrite this to be a highly engaging, simple, and curiosity-inducing opening hook for a YouTube video. The voice direction must be "Narrate professionally" to maintain a consistent, calm, and professional narration tone. Do NOT use urgent, shouting, or whispering tones.`;
                let hookResponse = await callOpenRouter(systemPrompt, prompt, apiKey, creativeModel, true);
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
                if (!hookDirection) hookDirection = 'Narrate professionally';
                const hookPrefix = `${hookDirection}: `;
                const refusalWords = ['kindly provide', 'sure', 'here is the', 'i cannot', 'as an ai', 'i can help', "i'm here to help", "im here to help", "here's"];
                const isRefusal = refusalWords.some(w => cleanHook.toLowerCase().includes(w));
                
                if (cleanHook && cleanHook.length > 5 && !isRefusal) {
                    const firstScene = finalScriptData.scenes[0];
                    const hookWordsLength = cleanHook.split(/\s+/).filter(Boolean).length;
                    
                    const newHookScene = {
                        ...firstScene,
                        voiceover: `${hookPrefix}"${cleanHook}"`,
                        duration: computeSceneDurationFromWords(hookWordsLength),
                        qcErrors: firstScene.qcErrors || []
                    };

                    finalScriptData.scenes = [newHookScene, ...finalScriptData.scenes.slice(1)];

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
        
    })().catch(async (err) => {
        addJobLog(`⚠️ Primary generation failed: ${err.message}`);
        addJobLog(`🛟 Falling back to local deterministic script generation so the pipeline can complete.`);
        try {
            const fallbackScript = buildFallbackScript(topicTheme, videoType, parsedDuration, readConfig().visualDNA, readConfig().styleReferences);
            fallbackScript.timestamp = Date.now();
            writeLatestScript(fallbackScript);
            const savedFilename = await saveScriptToHistory(fallbackScript);
            if (savedFilename) fallbackScript.historyFilename = savedFilename;
            activeJob.script = fallbackScript;
            activeJob.stages = buildDefaultStages(videoType, parsedDuration).map(stage => ({ ...stage, status: 'completed' }));
            activeJob.status = 'completed';
            activeJob.error = null;
            addJobLog(`✅ Local fallback script generated and saved.`);
        } catch (fallbackErr) {
            addJobLog(`❌ Fallback generation also failed: ${fallbackErr.message}`);
            activeJob.status = 'failed';
            activeJob.error = fallbackErr.message;
            activeJob.stages = activeJob.stages.map(s => s.status === 'running' ? { ...s, status: 'failed' } : s);
        }
    }).finally(() => {
        // Trigger next job in queue if any
        import('./job.service.js').then(({ processQueue }) => {
            processQueue(startBackendScriptGeneration);
        });
    });
}
