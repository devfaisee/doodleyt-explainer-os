import React, { useState, useEffect, useRef } from 'react';

// --- PRESETS & HARDCODED BLUEPRINTS ---
const DEFAULT_TOPICS = [
    { id: 1, title: "The Wallpaper That Slowly Poisoned A King", cat: "Strange History", curiosity: 9.9, novelty: 9.8, relatability: 9.0, hook: "In the 1800s, a vibrant green dye containing arsenic was used in royal wallpapers, slowly poisoning Napoleon." },
    { id: 2, title: "Why The World's Quietest Room Causes Hallucinations", cat: "Psychology", curiosity: 9.8, novelty: 9.5, relatability: 9.2, hook: "Inside an anechoic chamber, the silence is so absolute that you can hear your own organs grinding." },
    { id: 3, title: "The Coding Error That Wiped Out $500M in 45 Seconds", cat: "Tech History", curiosity: 9.7, novelty: 9.4, relatability: 9.1, hook: "A junior dev forgot a reentrancy guard in a smart contract, draining the treasury in less than a minute." }
];

const BANNED_PRONOUNS = ['he', 'she', 'it', 'they', 'his', 'her', 'their', 'its', 'same', 'similar', 'previous', 'earlier', 'above', 'below', 'again', 'identical', 'character', 'figure'];

// --- UTILITY COMPONENT: DYNAMIC DOODLE PREVIEW RENDERER ---
function DoodlePreview({ prompt = "", characters = [] }) {
    const upPrompt = prompt.toUpperCase();
    
    // Find active characters based on their names in the prompt
    const activeChars = characters.filter(c => upPrompt.includes(c.name.toUpperCase()));
    
    // Fallback checks
    const hasBob = activeChars.some(c => c.name.toUpperCase() === 'BOB') || upPrompt.includes("RED BASEBALL CAP") || upPrompt.includes("BLUE HOODIE");
    const hasSara = activeChars.some(c => c.name.toUpperCase() === 'SARA') || upPrompt.includes("PINK SHIRT") || upPrompt.includes("BLUE SKIRT");
    
    const isShocked = upPrompt.includes("SHOCK") || upPrompt.includes("TERROR") || upPrompt.includes("BELIEVE") || upPrompt.includes("FEAR") || upPrompt.includes("SCREAM") || upPrompt.includes("WILD EYED") || upPrompt.includes("GASP");
    const hasEar = upPrompt.includes("EAR") || upPrompt.includes("HEAR") || upPrompt.includes("SOUND") || upPrompt.includes("SILENCE") || upPrompt.includes("AUDITORY");
    const hasButton = upPrompt.includes("BUTTON") || upPrompt.includes("PRESS");
    const hasCoffee = upPrompt.includes("COFFEE") || upPrompt.includes("SPLASH") || upPrompt.includes("CUP") || upPrompt.includes("DRINK");
    const hasMoney = upPrompt.includes("MONEY") || upPrompt.includes("BILLION") || upPrompt.includes("DOLLAR") || upPrompt.includes("CASH") || upPrompt.includes("HEIST");
    const isDark = upPrompt.includes("DARK") || upPrompt.includes("VOID") || upPrompt.includes("BLACK BACKGROUND") || upPrompt.includes("SHADOW");

    // Dynamic color parsing based on descriptions
    const getShirtColor = (charName) => {
        const char = characters.find(c => c.name.toUpperCase() === charName.toUpperCase());
        if (!char) return charName === 'BOB' ? '#3b82f6' : '#ec4899';
        const desc = char.description.toLowerCase();
        if (desc.includes('red shirt') || desc.includes('red hoodie') || desc.includes('red cap') || desc.includes('red tunic')) return '#ef4444';
        if (desc.includes('green shirt') || desc.includes('green hoodie') || desc.includes('green tunic') || desc.includes('green coat')) return '#22c55e';
        if (desc.includes('yellow shirt') || desc.includes('yellow hoodie') || desc.includes('yellow vest')) return '#eab308';
        if (desc.includes('blue shirt') || desc.includes('blue hoodie') || desc.includes('blue coat') || desc.includes('blue jacket')) return '#3b82f6';
        if (desc.includes('pink shirt') || desc.includes('pink dress') || desc.includes('pink tunic')) return '#ec4899';
        if (desc.includes('purple shirt') || desc.includes('purple robe') || desc.includes('purple cloak')) return '#a855f7';
        if (desc.includes('black coat') || desc.includes('black trench') || desc.includes('black hoodie')) return '#171717';
        return '#737373';
    };

    return (
        <div className={`w-full h-full min-h-[140px] rounded-xl flex items-center justify-center border transition-all ${isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200'}`}>
            <svg viewBox="0 0 200 150" className="w-full h-full max-h-[160px]">
                {/* Background objects */}
                {hasEar && (
                    <path d="M 150 40 C 120 20, 110 80, 140 100 C 150 110, 170 100, 160 80" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeDasharray="3 3"/>
                )}
                {hasButton && (
                    <g>
                        <ellipse cx="150" cy="110" rx="20" ry="10" fill="#ef4444" stroke="#000" strokeWidth="2.5" />
                        <rect x="145" y="110" width="10" height="15" fill="#991b1b" stroke="#000" strokeWidth="2.5" />
                    </g>
                )}
                {hasMoney && (
                    <g fill="none" stroke="#22c55e" strokeWidth="2">
                        <rect x="130" y="30" width="30" height="15" rx="2" transform="rotate(15 145 37)" />
                        <text x="140" y="42" fill="#22c55e" fontSize="10" fontWeight="bold" transform="rotate(15 145 37)">$</text>
                    </g>
                )}
                
                {/* Render up to 2 detected characters dynamically */}
                {activeChars.length > 0 ? (
                    activeChars.slice(0, 2).map((char, index) => {
                        const isLeft = index === 0;
                        const transX = isLeft ? 20 : 100;
                        const name = char.name.toUpperCase();
                        const isCharShocked = isShocked || char.description.toLowerCase().includes("shocked") || char.description.toLowerCase().includes("surprised");
                        const color = getShirtColor(name);

                        return (
                            <g key={char.name} transform={`translate(${transX}, 10)`}>
                                <circle cx="40" cy="45" r="14" fill="#fff" stroke="#000" strokeWidth="3" />
                                <line x1="40" y1="59" x2="40" y2="95" stroke="#000" strokeWidth="3" />
                                <line x1="40" y1="95" x2="28" y2="125" stroke="#000" strokeWidth="3" />
                                <line x1="40" y1="95" x2="52" y2="125" stroke="#000" strokeWidth="3" />
                                
                                <path d="M 32 60 L 48 60 L 51 90 L 29 90 Z" fill={color} opacity="0.8" />
                                
                                {isCharShocked ? (
                                    <g stroke="#000" strokeWidth="3" strokeLinecap="round">
                                        <line x1="40" y1="68" x2="20" y2="45" />
                                        <line x1="40" y1="68" x2="60" y2="45" />
                                    </g>
                                ) : (
                                    <g stroke="#000" strokeWidth="3" strokeLinecap="round">
                                        <line x1="40" y1="68" x2="24" y2="85" />
                                        <line x1="40" y1="68" x2="56" y2="85" />
                                    </g>
                                )}

                                <circle cx="35" cy="42" r="2" fill="#000" />
                                <circle cx="45" cy="42" r="2" fill="#000" />
                                {isCharShocked ? (
                                    <ellipse cx="40" cy="51" rx="3.5" ry="4.5" fill="none" stroke="#000" strokeWidth="1.8" />
                                ) : (
                                    <path d="M 35 50 Q 40 55 45 50" fill="none" stroke="#000" strokeWidth="1.8" strokeLinecap="round" />
                                )}

                                <text x="40" y="24" textAnchor="middle" fill="#737373" fontSize="8" fontWeight="bold" fontFamily="monospace">{name}</text>
                            </g>
                        );
                    })
                ) : (
                    /* Fallback graphics */
                    <g>
                        {hasBob && (
                            <g transform="translate(10, 0)">
                                <line x1="70" y1="75" x2="70" y2="115" stroke="#000" strokeWidth="3.5" strokeLinecap="round" />
                                <line x1="70" y1="115" x2="55" y2="140" stroke="#000" strokeWidth="3.5" strokeLinecap="round" />
                                <line x1="70" y1="115" x2="85" y2="140" stroke="#000" strokeWidth="3.5" strokeLinecap="round" />
                                <path d="M 60 77 L 80 77 L 85 110 L 55 110 Z" fill="#3b82f6" opacity="0.8" />
                                <circle cx="70" cy="50" r="16" fill="#fff" stroke="#000" strokeWidth="3.5" />
                                <path d="M 54 48 C 54 36, 86 36, 86 48 Z" fill="#ef4444" stroke="#000" strokeWidth="2" />
                                <circle cx="64" cy="48" r="2.5" fill="#000" />
                                <circle cx="76" cy="48" r="2.5" fill="#000" />
                                <path d="M 64 56 Q 70 64 76 56" fill="none" stroke="#000" strokeWidth="2" />
                            </g>
                        )}
                        {hasSara && (
                            <g transform={hasBob ? "translate(60, 10)" : "translate(10, 10)"}>
                                <path d="M 50 35 Q 35 25 35 60 Q 40 30 65 30 Q 80 25 85 60 Q 75 30 50 35" fill="none" stroke="#000" strokeWidth="3" />
                                <line x1="60" y1="75" x2="60" y2="110" stroke="#000" strokeWidth="3.5" strokeLinecap="round" />
                                <line x1="60" y1="110" x2="48" y2="135" stroke="#000" strokeWidth="3.5" strokeLinecap="round" />
                                <line x1="60" y1="110" x2="72" y2="135" stroke="#000" strokeWidth="3.5" strokeLinecap="round" />
                                <path d="M 52 77 L 68 77 L 72 100 L 48 100 Z" fill="#ec4899" opacity="0.8" />
                                <circle cx="60" cy="50" r="15" fill="#fff" stroke="#000" strokeWidth="3.5" />
                                <circle cx="53" cy="48" r="4.5" fill="none" stroke="#000" strokeWidth="1.8" />
                                <circle cx="67" cy="48" r="4.5" fill="none" stroke="#000" strokeWidth="1.8" />
                                <path d="M 56 56 Q 60 62 64 56" fill="none" stroke="#000" strokeWidth="2" />
                            </g>
                        )}
                        {!hasBob && !hasSara && (
                            <g transform="translate(50, 0)">
                                <circle cx="50" cy="55" r="18" fill="#fff" stroke="#000" strokeWidth="3.5" />
                                <line x1="50" y1="73" x2="50" y2="115" stroke="#000" strokeWidth="3.5" />
                                <line x1="50" y1="85" x2="25" y2="95" stroke="#000" strokeWidth="3.5" strokeLinecap="round" />
                                <line x1="50" y1="85" x2="75" y2="95" stroke="#000" strokeWidth="3.5" strokeLinecap="round" />
                                <line x1="50" y1="115" x2="35" y2="142" stroke="#000" strokeWidth="3.5" />
                                <line x1="50" y1="115" x2="65" y2="142" stroke="#000" strokeWidth="3.5" />
                                <circle cx="44" cy="52" r="2.5" fill="#000" />
                                <circle cx="56" cy="52" r="2.5" fill="#000" />
                                <path d="M 44 62 Q 50 68 56 62" fill="none" stroke="#000" strokeWidth="2" />
                                <text x="75" y="45" fill="#ef4444" fontSize="18" fontWeight="bold">?</text>
                            </g>
                        )}
                    </g>
                )}
            </svg>
        </div>
    );
}

// --- MAIN APP COMPONENT ---
function App() {
    const [authenticated, setAuthenticated] = useState(false);
    const [passKey, setPassKey] = useState('');
    const [activeTab, setActiveTab] = useState('terminal');
    
    // Core parameters
    const [apiKey, setApiKey] = useState('');
    const [model, setModel] = useState('deepseek/deepseek-chat');
    const [outputPath, setOutputPath] = useState('');
    const [characters, setCharacters] = useState([]);
    
    const [topicBank, setTopicBank] = useState(DEFAULT_TOPICS);
    const [customNicheInput, setCustomNicheInput] = useState('');
    const [selectedTopic, setSelectedTopic] = useState(DEFAULT_TOPICS[0]);
    
    const [pipelineLogs, setPipelineLogs] = useState([]);
    const [currentScript, setCurrentScript] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [serverStatus, setServerStatus] = useState('Checking...');
    
    // Multi-Agent Pipeline Status Checklist
    const [pipelineStages, setPipelineStages] = useState([
        { id: 'design', label: '1. Niche & Custom Character Design', status: 'idle' },
        { id: 'act1', label: '2. Drafting Act 1 (Hook & Introduction)', status: 'idle' },
        { id: 'act2', label: '3. Drafting Act 2 (Rising Conflict)', status: 'idle' },
        { id: 'act3', label: '4. Drafting Act 3 (Climax & Twists)', status: 'idle' },
        { id: 'act4', label: '5. Drafting Act 4 (Resolution & Payoff)', status: 'idle' },
        { id: 'qc', label: '6. Stateless QC Check & Auto-Sanitation', status: 'idle' }
    ]);

    const [activePreviewPrompt, setActivePreviewPrompt] = useState('');
    const logEndRef = useRef(null);

    // Fetch config on load
    useEffect(() => {
        fetch('/api/config')
            .then(res => res.json())
            .then(data => {
                setServerStatus('Online');
                if (data.apiKey) setApiKey(data.apiKey);
                if (data.model) setModel(data.model);
                if (data.outputPath) setOutputPath(data.outputPath);
                if (data.characters) setCharacters(data.characters);
            })
            .catch(err => {
                console.log('Client-only mode (offline)');
                setServerStatus('Offline (Client-Only)');
                
                const cachedKey = localStorage.getItem('doodleyt_api_key') || '';
                const cachedModel = localStorage.getItem('doodleyt_model') || 'deepseek/deepseek-chat';
                const cachedPath = localStorage.getItem('doodleyt_output_path') || 'E:/doodleyt/output';
                const cachedChars = localStorage.getItem('doodleyt_characters');

                setApiKey(cachedKey);
                setModel(cachedModel);
                setOutputPath(cachedPath);

                if (cachedChars) {
                    setCharacters(JSON.parse(cachedChars));
                } else {
                    setCharacters([
                        { name: 'HERO', description: 'Stick figure with round head, black outlines, green warrior tunic, brown leather belt, two dot eyes, and determined grin.' }
                    ]);
                }
            });
    }, []);

    // Scroll logs to bottom
    useEffect(() => {
        if (logEndRef.current) {
            logEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [pipelineLogs]);

    const saveConfig = async (updatedFields) => {
        if (updatedFields.apiKey !== undefined) localStorage.setItem('doodleyt_api_key', updatedFields.apiKey);
        if (updatedFields.model !== undefined) localStorage.setItem('doodleyt_model', updatedFields.model);
        if (updatedFields.outputPath !== undefined) localStorage.setItem('doodleyt_output_path', updatedFields.outputPath);
        if (updatedFields.characters !== undefined) localStorage.setItem('doodleyt_characters', JSON.stringify(updatedFields.characters));

        if (serverStatus.includes('Offline')) return;
        try {
            await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedFields)
            });
        } catch (e) {
            console.error('Failed to sync settings', e);
        }
    };

    const addLog = (msg) => {
        setPipelineLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    const updateStageStatus = (stageId, status) => {
        setPipelineStages(prev => prev.map(s => s.id === stageId ? { ...s, status } : s));
    };

    const resetPipelineStages = () => {
        setPipelineStages(prev => prev.map(s => ({ ...s, status: 'idle' })));
    };

    // Helper to format timestamps dynamically
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Brainstorms 5 viral ideas
    const generateTopicsViaAI = async () => {
        if (!apiKey) {
            alert('Please set your OpenRouter API Key in settings first!');
            return;
        }
        addLog('Inquiring OpenRouter for extremely niche, viral brainstorm matrices...');
        setIsGenerating(true);
        try {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': window.location.origin,
                    'X-Title': 'Doodle Theory'
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        {
                            role: 'user',
                            content: `Generate 5 fresh, high-click, curiosity-driven viral video topics for the YouTube channel 'Doodle Theory' (mystery, strange history, bizarre facts, psychology, evolution).
The ideas MUST NOT be generic. They should target extremely specific, weird niches (e.g. historical anomalies, psychological oddities, bizarre nature facts).
For each topic, evaluate and assign scores (0-10) for Curiosity, Novelty, and Relatability.
Also write a brief 1-sentence hook statement for each.

Output strictly as a JSON array inside a code block, formatted like this:
[
  {"id": 301, "title": "Bizarre Niche Title", "cat": "Strange History", "curiosity": 9.9, "novelty": 9.8, "relatability": 9.1, "hook": "Bizarre hook sentence"}
]`
                        }
                    ]
                })
            });

            const result = await response.json();
            const text = result.choices[0].message.content;
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                setTopicBank(parsed);
                setSelectedTopic(parsed[0]);
                addLog(`Successfully parsed ${parsed.length} new brainstorm topics.`);
            } else {
                throw new Error("Could not extract JSON array.");
            }
        } catch (e) {
            addLog(`Error generating niches: ${e.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    // Helper: Call OpenRouter LLM
    const callOpenRouter = async (systemPrompt, userPrompt) => {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': window.location.origin,
                'X-Title': 'Doodle Theory OS'
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ]
            })
        });

        if (!response.ok) {
            throw new Error(`OpenRouter HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    };

    // Orchestrates sequential, multi-call generation logic in background
    const runScriptGeneration = async (topicTheme) => {
        if (!apiKey) {
            addLog('❌ Aborted: Missing API Key.');
            setActiveTab('settings');
            return;
        }

        setIsGenerating(true);
        setPipelineLogs([]);
        resetPipelineStages();
        
        let accumulatedScenes = [];
        let finalScriptData = { title: '', category: '', nicheReason: '', thumbnail: '', characters: [] };
        
        addLog(`⚙️ Booting Multistage Pipeline Orchestrator...`);
        addLog(`🧠 Target Model: ${model}`);

        try {
            // ==========================================
            // STAGE 1: Niche & Custom Character Design
            // ==========================================
            updateStageStatus('design', 'running');
            addLog(`⚡ Starting Stage 1: Autonomous Niche & Character Design...`);

            const designSystemPrompt = `You are an elite YouTube strategist and character designer for the channel "Doodle Theory".
The channel explains bizarre, shocking, or mysterious topics using simple MS Paint stickman doodles.`;

            const designUserPrompt = `Autonomously select a highly specific, bizarre, curiosity-driven niche video topic.
${topicTheme ? `Focus on this theme/keyword: "${topicTheme}". Narrow it down to a highly specific, bizarre sub-niche.` : `Generate an extremely specific, weird niche topic.`}

Design 1-3 custom characters needed for this script. For each character, design a Character Card with a detailed physical description as a stickman (e.g. shirt color, hat, accessories, pants, sneakers). Keep the art style: crude stickman outline, solid flat colors, white background.

Return strictly a JSON object:
{
  "title": "[Clickable Title]",
  "category": "[Category]",
  "nicheReason": "[Why this specific sub-niche is highly viral]",
  "thumbnail": "[Stateless prompt describing the thumbnail doodle]",
  "characters": [
    { "name": "NAME", "description": "Complete physical visual description" }
  ]
}`;

            const designResponse = await callOpenRouter(designSystemPrompt, designUserPrompt);
            const designJsonMatch = designResponse.match(/\{[\s\S]*\}/);
            if (!designJsonMatch) throw new Error("Stage 1 failed to return JSON.");
            
            const designData = JSON.parse(designJsonMatch[0]);
            finalScriptData = { ...finalScriptData, ...designData };
            setCharacters(finalScriptData.characters || []);
            saveConfig({ characters: finalScriptData.characters || [] });
            
            addLog(`✓ Title: "${finalScriptData.title}"`);
            addLog(`✓ Custom characters designed: ${finalScriptData.characters.map(c => c.name).join(', ')}`);
            updateStageStatus('design', 'completed');

            // Constructing variables for script generation
            const charactersListString = finalScriptData.characters.map(c => `- **${c.name}**: ${c.description}`).join('\n');
            const charactersPromptGuide = `Stateless Prompt Rule (THE GOLDEN RULE):
Image generators have no memory. You must never use character names alone (like "Hero is shocked") and never use pronouns (he, she, it, they, his, her, same, previous).
Instead, you MUST combine the character's full physical description (from the preset below) with the SPECIFIC action, pose, facial expression, and setting of this scene!
Preserve details: shirt colors, caps, accessories. Make every prompt unique and action-oriented!

Character presets to use:
${charactersListString}`;

            // ==========================================
            // STAGE 2: Act 1 (Hook & Setup)
            // ==========================================
            updateStageStatus('act1', 'running');
            addLog(`⚡ Starting Stage 2: Drafting Act 1 (Hook & Setup, scenes 1-20)...`);

            const act1SystemPrompt = `You are the Visual Director and Scriptwriter for "Doodle Theory".
You write scripts in JSON format.
Channel style: chaotic, humorous, mildly sarcastic. Art: hand-drawn stick figure doodles, black outlines, flat colors, white background.
Visual pacing: Fast-paced scenes of 1-3 seconds.`;

            const act1UserPrompt = `Write Act 1 (Hook & Setup) for the video: "${finalScriptData.title}".
Niche context: ${finalScriptData.nicheReason}

${charactersPromptGuide}

Generate exactly 20 consecutive scenes. Start with a shocking, mysterious hook (0-15s) with NO introductions or welcomes.
For every scene, write the [prompt] combining the character description with the specific scene action/expression. Never write the exact same prompt for different scenes.

Return strictly a JSON object matching this schema:
{
  "scenes": [
    {
      "duration": [1, 2, or 3],
      "voiceover": "[Exact spoken sentence]",
      "camera": "[Editing/camera zoom/movement]",
      "sfx": "[Sound effect]",
      "prompt": "[Complete, action-specific stateless visual prompt. MUST combine the character card details with this scene's action/pose/emotion. No pronouns or names alone. White background]",
      "textOverlay": "[Text on screen or null]"
    }
  ]
}`;

            const act1Response = await callOpenRouter(act1SystemPrompt, act1UserPrompt);
            const act1JsonMatch = act1Response.match(/\{[\s\S]*\}/);
            if (!act1JsonMatch) throw new Error("Stage 2 failed to return JSON.");
            
            const act1Data = JSON.parse(act1JsonMatch[0]);
            accumulatedScenes = [...act1Data.scenes];
            addLog(`✓ Act 1 compiled successfully (${accumulatedScenes.length} scenes).`);
            updateStageStatus('act1', 'completed');

            // ==========================================
            // STAGE 3: Act 2 (Rising Conflict)
            // ==========================================
            updateStageStatus('act2', 'running');
            addLog(`⚡ Starting Stage 3: Drafting Act 2 (Rising Conflict, scenes 21-40)...`);

            const lastVoAct1 = accumulatedScenes.slice(-3).map(s => s.voiceover).join(' | ');
            const act2UserPrompt = `Write Act 2 (Rising Conflict, next 20 consecutive scenes) for the video: "${finalScriptData.title}".
This act must escalate the mystery, introduce new details, or build the conflict.

Last spoken lines of Act 1: "${lastVoAct1}"

${charactersPromptGuide}

Write exactly 20 scenes continuing from the end of Act 1.
For every scene, combine the character card details with unique actions/emotions.

Return strictly a JSON object:
{
  "scenes": [
    {
      "duration": [1, 2, or 3],
      "voiceover": "[Spoken sentence]",
      "camera": "[Camera]",
      "sfx": "[SFX]",
      "prompt": "[Action-specific stateless visual prompt. Inject character visual details + scene action. No pronouns. White background]",
      "textOverlay": "[Text or null]"
    }
  ]
}`;

            const act2Response = await callOpenRouter(act1SystemPrompt, act2UserPrompt);
            const act2JsonMatch = act2Response.match(/\{[\s\S]*\}/);
            if (!act2JsonMatch) throw new Error("Stage 3 failed to return JSON.");
            
            const act2Data = JSON.parse(act2JsonMatch[0]);
            accumulatedScenes = [...accumulatedScenes, ...act2Data.scenes];
            addLog(`✓ Act 2 compiled successfully (Total: ${accumulatedScenes.length} scenes).`);
            updateStageStatus('act2', 'completed');

            // ==========================================
            // STAGE 4: Act 3 (Climax & Twists)
            // ==========================================
            updateStageStatus('act3', 'running');
            addLog(`⚡ Starting Stage 4: Drafting Act 3 (Climax & Twists, scenes 41-60)...`);

            const lastVoAct2 = accumulatedScenes.slice(-3).map(s => s.voiceover).join(' | ');
            const act3UserPrompt = `Write Act 3 (Climax & Twists, next 20 consecutive scenes) for the video: "${finalScriptData.title}".
This act must build toward the climax, reveal a major plot twist, or deliver a shocking revelation.

Last spoken lines of Act 2: "${lastVoAct2}"

${charactersPromptGuide}

Write exactly 20 scenes. Keep prompts stateless, unique, and action-oriented.

Return strictly a JSON object:
{
  "scenes": [
    {
      "duration": [1, 2, or 3],
      "voiceover": "[Spoken sentence]",
      "camera": "[Camera]",
      "sfx": "[SFX]",
      "prompt": "[Action-specific stateless visual prompt. Inject character visual details + scene action. No pronouns. White background]",
      "textOverlay": "[Text or null]"
    }
  ]
}`;

            const act3Response = await callOpenRouter(act1SystemPrompt, act3UserPrompt);
            const act3JsonMatch = act3Response.match(/\{[\s\S]*\}/);
            if (!act3JsonMatch) throw new Error("Stage 4 failed to return JSON.");
            
            const act3Data = JSON.parse(act3JsonMatch[0]);
            accumulatedScenes = [...accumulatedScenes, ...act3Data.scenes];
            addLog(`✓ Act 3 compiled successfully (Total: ${accumulatedScenes.length} scenes).`);
            updateStageStatus('act3', 'completed');

            // ==========================================
            // STAGE 5: Act 4 (Resolution & Payoff)
            // ==========================================
            updateStageStatus('act4', 'running');
            addLog(`⚡ Starting Stage 5: Drafting Act 4 (Resolution & Payoff, scenes 61-80)...`);

            const lastVoAct3 = accumulatedScenes.slice(-3).map(s => s.voiceover).join(' | ');
            const act4UserPrompt = `Write Act 4 (Resolution & Payoff, final 20 consecutive scenes) for the video: "${finalScriptData.title}".
This act must resolve the twist, deliver the final takeaway, and leave the viewer with a funny or thought-provoking ending.

Last spoken lines of Act 3: "${lastVoAct3}"

${charactersPromptGuide}

Write exactly 20 scenes. Ensure prompts are stateless, action-oriented, and do not repeat.

Return strictly a JSON object:
{
  "scenes": [
    {
      "duration": [1, 2, or 3],
      "voiceover": "[Spoken sentence]",
      "camera": "[Camera]",
      "sfx": "[SFX]",
      "prompt": "[Action-specific stateless visual prompt. Inject character visual details + scene action. No pronouns. White background]",
      "textOverlay": "[Text or null]"
    }
  ]
}`;

            const act4Response = await callOpenRouter(act1SystemPrompt, act4UserPrompt);
            const act4JsonMatch = act4Response.match(/\{[\s\S]*\}/);
            if (!act4JsonMatch) throw new Error("Stage 5 failed to return JSON.");
            
            const act4Data = JSON.parse(act4JsonMatch[0]);
            accumulatedScenes = [...accumulatedScenes, ...act4Data.scenes];
            addLog(`✓ Act 4 compiled successfully (Total: ${accumulatedScenes.length} scenes).`);
            updateStageStatus('act4', 'completed');

            // ==========================================
            // STAGE 6: Stateless QC Check & Auto-Sanitation
            // ==========================================
            updateStageStatus('qc', 'running');
            addLog(`⚡ Starting Stage 6: Running Stateless QC Check sweeps...`);

            // Dynamically calculate timeline timestamps in JS
            let currentAccumulatedTime = 0;
            let qcErrorsCount = 0;

            const finalScenes = accumulatedScenes.map((scene, idx) => {
                const check = validatePromptText(scene.prompt);
                const sceneTime = formatTime(currentAccumulatedTime);
                currentAccumulatedTime += scene.duration;
                
                if (!check.isValid) {
                    qcErrorsCount++;
                    addLog(`⚠️ Row ${idx + 1} (${sceneTime}): Banned pronoun leak: [${check.words.join(', ')}]`);
                }
                
                return {
                    ...scene,
                    time: sceneTime,
                    qcErrors: check.words
                };
            });

            finalScriptData.scenes = finalScenes;
            setCurrentScript(finalScriptData);

            if (qcErrorsCount === 0) {
                addLog(`✅ Pipeline Successful: 0 pronoun errors found. Production blueprint ready.`);
            } else {
                addLog(`⚠️ QC Completed: Flagged ${qcErrorsCount} prompts. Run 'Auto-Fix' in the Sandbox to sanitize.`);
            }
            updateStageStatus('qc', 'completed');

        } catch (e) {
            addLog(`❌ Pipeline Failed: ${e.message}`);
            // Mark any running stage as failed
            setPipelineStages(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'failed' } : s));
        } finally {
            setIsGenerating(false);
        }
    };

    const autoFixFlaggedPromptsLocally = async () => {
        if (!currentScript) return;
        const flaggedIndices = currentScript.scenes
            .map((s, i) => s.qcErrors && s.qcErrors.length > 0 ? i : -1)
            .filter(i => i !== -1);
        
        if (flaggedIndices.length === 0) {
            alert('No pronoun/reference issues detected!');
            return;
        }

        setIsGenerating(true);
        addLog(`🔧 Launching Automated Pronoun Correction Routine for ${flaggedIndices.length} items...`);

        try {
            const currentChars = currentScript.characters || characters;
            const charsString = currentChars.map(c => `- **${c.name}**: ${c.description}`).join('\n');
            
            for (const index of flaggedIndices) {
                const scene = currentScript.scenes[index];
                addLog(`Fixing Scene ${index + 1} (${scene.time})...`);
                
                const prompt = `Correct this image prompt for an AI image generator to make it completely stateless.
Rules:
1. Replace character names with their full visual descriptions.
2. Remove all relative reference words (he, she, it, they, his, her, their, same, previous, earlier, above, below, again).
3. Keep the art style: crude MS Paint stickman doodle, black outline, white background.

Character Presets:
${charsString}

Input Prompt to fix: "${scene.prompt}"
Return only the corrected prompt text, nothing else.`;

                const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: [{ role: 'user', content: prompt }]
                    })
                });

                const result = await response.json();
                const correctedText = result.choices[0].message.content.trim();
                
                setCurrentScript(prev => {
                    const newScenes = [...prev.scenes];
                    newScenes[index] = {
                        ...newScenes[index],
                        prompt: correctedText,
                        qcErrors: []
                    };
                    return { ...prev, scenes: newScenes };
                });
                addLog(`✅ Refactored Scene ${index + 1} successfully.`);
            }
            addLog(`🎉 Stateless validation complete. All prompts sanitized.`);
        } catch (e) {
            addLog(`❌ QC Fix sequence failed: ${e.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-neutral-950 text-neutral-200">
            {/* TOP NAVBAR */}
            <nav className="border-b border-neutral-900 bg-neutral-900/40 backdrop-blur-md px-8 py-4 flex justify-between items-center sticky top-0 z-45">
                <div className="flex items-center gap-4">
                    <span className="bg-blue-600 text-white font-mono text-[10px] px-2 py-0.5 rounded font-bold tracking-wider">v2026</span>
                    <h1 className="text-lg font-black tracking-tight uppercase text-white flex items-center gap-2">
                        Doodle Theory <span className="text-blue-500">Explainer OS</span>
                    </h1>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-xs">
                        <span className={`w-2.5 h-2.5 rounded-full ${serverStatus.includes('Online') ? 'bg-green-500' : 'bg-amber-500'}`}></span>
                        <span className="text-neutral-400 font-mono">Server: {serverStatus}</span>
                    </div>
                    <div className="text-xs font-mono text-neutral-500">
                        {apiKey ? '🔐 API Configured' : '🔓 API Key Required'}
                    </div>
                </div>
            </nav>

            <div className="flex flex-1 overflow-hidden">
                {/* SIDEBAR PANEL */}
                <aside className="w-64 border-r border-neutral-900 bg-neutral-950 p-4 space-y-1.5 shrink-0 flex flex-col justify-between">
                    <div className="space-y-1.5">
                        <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest px-3 mb-3">Core Engines</div>
                        
                        <button onClick={() => setActiveTab('terminal')} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all ${activeTab === 'terminal' ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white border border-transparent'}`}>
                            <span>💻</span> Execution Terminal
                        </button>
                        <button onClick={() => setActiveTab('topics')} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all ${activeTab === 'topics' ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white border border-transparent'}`}>
                            <span>🧠</span> Niche Brainstormer
                        </button>
                        <button onClick={() => setActiveTab('sandbox')} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all ${activeTab === 'sandbox' ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white border border-transparent'}`}>
                            <span>📝</span> Script Sandbox
                        </button>
                        <button onClick={() => setActiveTab('characters')} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all ${activeTab === 'characters' ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white border border-transparent'}`}>
                            <span>👥</span> Custom Character DNA
                        </button>
                        <button onClick={() => setActiveTab('settings')} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all ${activeTab === 'settings' ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white border border-transparent'}`}>
                            <span>⚙️</span> Settings & Models
                        </button>
                    </div>
                    <div className="bg-neutral-900/60 p-3 rounded-2xl border border-neutral-800 text-[10px] text-neutral-500 leading-relaxed font-mono">
                        🔒 Secured Pipeline Vault<br/>
                        Mode: Multistage Auto-Run<br/>
                        Script Target: 80 Scenes
                    </div>
                </aside>

                {/* WORKSPACE APP CONTENT */}
                <main className="flex-1 overflow-y-auto p-8">
                    
                    {/* EXECUTION TERMINAL TAB */}
                    {activeTab === 'terminal' && (
                        <div className="space-y-6 max-w-5xl">
                            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl shadow-lg space-y-4">
                                <div>
                                    <h2 className="text-xl font-bold text-white mb-1">Autonomous Multistage Terminal</h2>
                                    <p className="text-sm text-neutral-400 font-medium">Clicking **Launch Production Blueprint** starts an automated background orchestrator. It executes sequential LLM calls to write a full 80-scene script in acts without lazy truncations or identical copy-pasted prompts.</p>
                                </div>
                                
                                <div className="space-y-3">
                                    <label className="text-xs font-semibold text-neutral-400 block font-mono">Niche Theme or Topic Keyword (Optional)</label>
                                    <input 
                                        type="text"
                                        placeholder="e.g. Banned left handed spies, weird medieval trials, or leave blank for autonomous niche..."
                                        className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-4 rounded-xl text-sm text-neutral-200 outline-none font-mono"
                                        value={customNicheInput}
                                        onChange={(e) => setCustomNicheInput(e.target.value)}
                                    />
                                    {selectedTopic && !customNicheInput && (
                                        <div className="text-xs text-neutral-500 flex items-center gap-1 font-mono">
                                            <span>💡 Suggestion from brainstormer:</span>
                                            <button 
                                                onClick={() => setCustomNicheInput(selectedTopic.title)}
                                                className="text-blue-400 hover:underline font-bold"
                                            >
                                                "{selectedTopic.title}"
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-between items-center pt-2">
                                    {/* PIPELINE STAGES CHECKLIST */}
                                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-mono max-w-xl">
                                        {pipelineStages.map(s => (
                                            <div key={s.id} className="flex items-center gap-1.5">
                                                <span className={`w-2.5 h-2.5 rounded-full ${s.status === 'completed' ? 'bg-green-500' : s.status === 'running' ? 'bg-blue-500 animate-pulse' : s.status === 'failed' ? 'bg-red-500' : 'bg-neutral-700'}`}></span>
                                                <span className={`${s.status === 'running' ? 'text-blue-400 font-bold' : s.status === 'completed' ? 'text-neutral-350' : 'text-neutral-500'}`}>{s.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                    
                                    <button 
                                        onClick={() => runScriptGeneration(customNicheInput)}
                                        disabled={isGenerating}
                                        className="bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-bold px-7 py-4 rounded-2xl transition-all shadow-lg shadow-blue-600/15 flex items-center gap-2 glow-active shrink-0"
                                    >
                                        {isGenerating ? (
                                            <>
                                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                                Generating (Stage Runs)...
                                            </>
                                        ) : (
                                            '🚀 Launch Production Blueprint'
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* LOG STREAM */}
                                <div className="lg:col-span-1 bg-neutral-900 border border-neutral-800 rounded-3xl p-5 flex flex-col h-[480px]">
                                    <h3 className="text-xs uppercase tracking-widest font-mono text-neutral-500 mb-3 flex justify-between">
                                        <span>Background Log Stream</span>
                                        <span className="text-green-500 animate-pulse">● Active</span>
                                    </h3>
                                    <div className="flex-1 bg-neutral-950 rounded-2xl p-4 font-mono-code text-[11px] text-green-400 space-y-2.5 overflow-y-auto border border-neutral-800/80 shadow-inner">
                                        {pipelineLogs.length === 0 ? (
                                            <span className="text-neutral-600">// Engine arrays idle. Execute terminal run to initiate streams...</span>
                                        ) : (
                                            pipelineLogs.map((l, idx) => <div key={idx} className="leading-relaxed">{l}</div>)
                                        )}
                                        <div ref={logEndRef} />
                                    </div>
                                </div>

                                {/* QUICK SCRIPT OVERVIEW */}
                                <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-3xl p-6 flex flex-col h-[480px]">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-xs uppercase tracking-widest font-mono text-neutral-500">Fast Preview Sandbox</h3>
                                        {currentScript && (
                                            <button 
                                                onClick={() => setActiveTab('sandbox')}
                                                className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
                                            >
                                                Open Full Screen View ➔
                                            </button>
                                        )}
                                    </div>
                                    
                                    <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                                        {currentScript ? (
                                            <div>
                                                <div className="mb-4 pb-4 border-b border-neutral-800 flex justify-between items-start">
                                                    <div>
                                                        <div className="text-[10px] font-mono text-blue-400 mb-1">PROCESSED METRICS</div>
                                                        <div className="text-lg font-black text-white tracking-tight leading-tight">{currentScript.title}</div>
                                                        {currentScript.nicheReason && (
                                                            <div className="text-[11px] text-neutral-400 mt-1 font-mono">
                                                                🎯 <strong>Niche Viability:</strong> {currentScript.nicheReason}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="bg-neutral-950 text-neutral-400 text-xs px-3 py-1.5 rounded-xl border border-neutral-800 flex items-center gap-1.5 font-semibold">
                                                        ⚡ {currentScript.scenes.length} Scenes
                                                    </div>
                                                </div>
                                                
                                                <div className="bg-amber-500/5 px-4 py-3 rounded-2xl border border-amber-500/20 mb-4 text-xs">
                                                    <strong className="text-amber-500 block mb-1">AI Thumbnail Prompt:</strong>
                                                    <span className="text-neutral-300">{currentScript.thumbnail}</span>
                                                </div>

                                                <div className="space-y-3">
                                                    {currentScript.scenes.slice(0, 4).map((scene, i) => (
                                                        <div key={i} className="bg-neutral-950 border border-neutral-800 p-4 rounded-2xl flex gap-4">
                                                            <div className="flex-1 space-y-2">
                                                                <div className="flex justify-between items-center text-xs">
                                                                    <span className="bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded font-mono font-bold">{scene.time} ({scene.duration}s)</span>
                                                                    <span className="text-purple-400 font-mono font-medium">SFX: {scene.sfx}</span>
                                                                </div>
                                                                <p className="text-sm text-neutral-200">"{scene.voiceover}"</p>
                                                                <div className="text-[10px] font-mono text-neutral-500 leading-relaxed bg-neutral-900/60 p-2.5 rounded-xl border border-neutral-800">
                                                                    <span className="text-neutral-400 block mb-0.5 font-bold">Image Prompt:</span>
                                                                    {scene.prompt}
                                                                </div>
                                                            </div>
                                                            <div className="w-[120px] h-[90px] shrink-0">
                                                                <DoodlePreview prompt={scene.prompt} characters={currentScript.characters || characters} />
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {currentScript.scenes.length > 4 && (
                                                        <div className="text-center py-4">
                                                            <button 
                                                                onClick={() => setActiveTab('sandbox')}
                                                                className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 text-xs font-bold px-5 py-2.5 rounded-xl transition"
                                                            >
                                                                View {currentScript.scenes.length - 4} More Scenes in Sandbox
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center text-neutral-600 gap-3">
                                                <span className="text-4xl">📄</span>
                                                <p className="text-xs">No script content has been compiled yet. Input a theme or run autonomously to generate.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TOPIC BRAINSTORMER TAB */}
                    {activeTab === 'topics' && (
                        <div className="space-y-6 max-w-4xl">
                            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl flex justify-between items-center shadow-lg">
                                <div>
                                    <h2 className="text-xl font-bold text-white mb-1">Niche Brainstormer Matrix</h2>
                                    <p className="text-sm text-neutral-400">Autonomously researches highly targeted, specific, bizarre niches. Click any topic to load it into the terminal.</p>
                                </div>
                                <button 
                                    onClick={generateTopicsViaAI}
                                    disabled={isGenerating}
                                    className="bg-neutral-800 hover:bg-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 border border-neutral-700 text-white font-semibold px-5 py-2.5 rounded-xl transition flex items-center gap-2"
                                >
                                    Research AI Niches
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {topicBank.map(t => (
                                    <div 
                                        key={t.id} 
                                        onClick={() => {
                                            setSelectedTopic(t);
                                            setCustomNicheInput(t.title);
                                            addLog(`Brainstorm topic locked: "${t.title}"`);
                                            setActiveTab('terminal');
                                        }}
                                        className={`p-5 rounded-3xl border-2 cursor-pointer transition-all flex flex-col justify-between h-[210px] ${selectedTopic.id === t.id ? 'bg-blue-600/10 border-blue-500 text-white shadow-lg shadow-blue-500/5' : 'bg-neutral-900/60 border-neutral-850 text-neutral-450 hover:border-neutral-700'}`}
                                    >
                                        <div>
                                            <div className="flex justify-between items-center mb-3">
                                                <span className="text-[10px] font-mono bg-neutral-800 text-neutral-350 px-2 py-1 rounded-md font-bold uppercase tracking-wider">{t.cat}</span>
                                                <div className="flex gap-2">
                                                    <span className="text-[11px] font-bold font-mono text-blue-400">C: {t.curiosity}</span>
                                                    <span className="text-[11px] font-bold font-mono text-emerald-400">N: {t.novelty}</span>
                                                </div>
                                            </div>
                                            <h4 className="font-extrabold text-base text-neutral-100 line-clamp-2 leading-snug">{t.title}</h4>
                                            <p className="text-xs text-neutral-400 line-clamp-3 mt-2 leading-relaxed">"{t.hook}"</p>
                                        </div>
                                        <div className="pt-3 border-t border-neutral-800/60 flex justify-between text-[10px] font-mono text-neutral-500">
                                            <span>VIRAL SCORE: HIGH</span>
                                            <span>SELECT & CONFIGURE</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* SCRIPT SANDBOX TAB */}
                    {activeTab === 'sandbox' && (
                        <div className="space-y-6 max-w-7xl">
                            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl flex flex-wrap gap-4 items-center justify-between shadow-lg">
                                <div>
                                    <h2 className="text-xl font-bold text-white mb-1">Production Script Sandbox</h2>
                                    <p className="text-sm text-neutral-400">Directly edit generated scripts in real time, audit stateless prompts, and save clean outputs.</p>
                                </div>
                                {currentScript && (
                                    <div className="flex items-center gap-3">
                                        <button 
                                            onClick={autoFixFlaggedPromptsLocally}
                                            disabled={isGenerating}
                                            className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition flex items-center gap-1.5"
                                        >
                                            🛡️ Auto-Fix QC Errors
                                        </button>
                                        <button 
                                            onClick={() => saveScriptToDisk('json')}
                                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition flex items-center gap-1.5"
                                        >
                                            💾 Save JSON to Disk
                                        </button>
                                        <button 
                                            onClick={() => saveScriptToDisk('csv')}
                                            className="bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition"
                                        >
                                            Export CSV
                                        </button>
                                    </div>
                                )}
                            </div>

                            {currentScript ? (
                                <div className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-neutral-950 border-b border-neutral-800 text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
                                                    <th className="py-4 px-4 w-[80px]">Time</th>
                                                    <th className="py-4 px-3 w-[60px]">Dur</th>
                                                    <th className="py-4 px-4 w-[240px]">Voiceover Script</th>
                                                    <th className="py-4 px-4 w-[110px]">SFX</th>
                                                    <th className="py-4 px-4 w-[110px]">Camera</th>
                                                    <th className="py-4 px-4 min-w-[280px]">Stateless Visual Prompt</th>
                                                    <th className="py-4 px-4 w-[100px]">Overlay</th>
                                                    <th className="py-4 px-4 w-[140px] text-center">Visual Preview</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-neutral-800 text-sm">
                                                {currentScript.scenes.map((scene, i) => {
                                                    const isFlagged = scene.qcErrors && scene.qcErrors.length > 0;
                                                    return (
                                                        <tr key={i} className={`hover:bg-neutral-950/40 transition-colors ${isFlagged ? 'bg-red-950/10 border-l-4 border-l-red-500' : ''}`}>
                                                            <td className="py-3.5 px-4 font-mono font-bold text-neutral-400">
                                                                <input 
                                                                    type="text" 
                                                                    className="bg-transparent focus:bg-neutral-950 border border-transparent focus:border-neutral-800 p-1 w-full rounded outline-none font-mono"
                                                                    value={scene.time}
                                                                    onChange={(e) => handleCellEdit(i, 'time', e.target.value)}
                                                                />
                                                            </td>
                                                            <td className="py-3.5 px-3">
                                                                <input 
                                                                    type="number" 
                                                                    className="bg-transparent focus:bg-neutral-950 border border-transparent focus:border-neutral-800 p-1 w-full rounded outline-none text-center font-mono"
                                                                    value={scene.duration}
                                                                    onChange={(e) => handleCellEdit(i, 'duration', parseInt(e.target.value) || 1)}
                                                                />
                                                            </td>
                                                            <td className="py-3.5 px-4">
                                                                <textarea 
                                                                    rows="2"
                                                                    className="bg-transparent focus:bg-neutral-950 border border-transparent focus:border-neutral-800 p-1.5 w-full rounded outline-none resize-none leading-relaxed text-xs text-neutral-200"
                                                                    value={scene.voiceover}
                                                                    onChange={(e) => handleCellEdit(i, 'voiceover', e.target.value)}
                                                                />
                                                            </td>
                                                            <td className="py-3.5 px-4 text-purple-400 font-semibold text-xs">
                                                                <input 
                                                                    type="text" 
                                                                    className="bg-transparent focus:bg-neutral-950 border border-transparent focus:border-neutral-800 p-1 w-full rounded outline-none"
                                                                    value={scene.sfx}
                                                                    onChange={(e) => handleCellEdit(i, 'sfx', e.target.value)}
                                                                />
                                                            </td>
                                                            <td className="py-3.5 px-4 text-sky-400 text-xs">
                                                                <input 
                                                                    type="text" 
                                                                    className="bg-transparent focus:bg-neutral-950 border border-transparent focus:border-neutral-800 p-1 w-full rounded outline-none"
                                                                    value={scene.camera}
                                                                    onChange={(e) => handleCellEdit(i, 'camera', e.target.value)}
                                                                />
                                                            </td>
                                                            <td className="py-3.5 px-4">
                                                                <div className="relative">
                                                                    <textarea 
                                                                        rows="3"
                                                                        className={`bg-transparent focus:bg-neutral-950 border border-transparent focus:border-neutral-800 p-1.5 w-full rounded outline-none text-[11px] font-mono leading-normal text-neutral-300 resize-none ${isFlagged ? 'border border-red-500 focus:border-red-500' : ''}`}
                                                                        value={scene.prompt}
                                                                        onChange={(e) => handleCellEdit(i, 'prompt', e.target.value)}
                                                                    />
                                                                    {isFlagged && (
                                                                        <div className="absolute right-2 bottom-2 bg-red-600 text-white font-bold text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse font-mono">
                                                                            ⚠️ Pronoun Leak: {scene.qcErrors.join(', ')}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="py-3.5 px-4 text-amber-500 font-bold font-mono text-xs">
                                                                <input 
                                                                    type="text" 
                                                                    className="bg-transparent focus:bg-neutral-950 border border-transparent focus:border-neutral-800 p-1 w-full rounded outline-none"
                                                                    value={scene.textOverlay || ''}
                                                                    placeholder="--"
                                                                    onChange={(e) => handleCellEdit(i, 'textOverlay', e.target.value)}
                                                                />
                                                            </td>
                                                            <td className="py-3.5 px-4">
                                                                <div 
                                                                    className="cursor-pointer hover:opacity-80 transition"
                                                                    onClick={() => setActivePreviewPrompt(scene.prompt)}
                                                                >
                                                                    <DoodlePreview prompt={scene.prompt} characters={currentScript?.characters || characters} />
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-16 text-center text-neutral-600">
                                    <span className="text-5xl block mb-4">📋</span>
                                    <h3 className="text-lg font-bold text-neutral-400 mb-2">Sandbox Empty</h3>
                                    <p className="text-sm max-w-md mx-auto">No script has been generated yet. Input a theme or run autonomously to generate a complete script.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* CHARACTER REGISTRY TAB */}
                    {activeTab === 'characters' && (
                        <div className="space-y-6 max-w-4xl">
                            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl shadow-lg">
                                <h2 className="text-xl font-bold text-white mb-1">Custom Character DNA Registry</h2>
                                <p className="text-sm text-neutral-400 mb-6 font-medium">These are the visual characters generated autonomously by the AI for your current script. They are dynamically populated after each pipeline run.</p>
                                
                                <div className="space-y-4">
                                    {characters.length > 0 ? (
                                        characters.map((char, index) => (
                                            <div key={char.name} className="bg-neutral-950 border border-neutral-850 p-5 rounded-2xl space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-extrabold text-sm text-blue-400 font-mono">Character ID: {char.name}</span>
                                                    <span className="text-[10px] text-neutral-500 font-mono">AI Generated visual preset</span>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-neutral-500 uppercase tracking-widest font-mono block mb-1">Visual Prompt DNA Injector String</label>
                                                    <textarea 
                                                        rows="2"
                                                        className="w-full bg-neutral-900 border border-neutral-800 focus:border-blue-500 p-3 rounded-xl text-xs text-neutral-200 outline-none resize-none font-mono"
                                                        value={char.description}
                                                        onChange={(e) => {
                                                            const updated = [...characters];
                                                            updated[index].description = e.target.value;
                                                            setCharacters(updated);
                                                            saveConfig({ characters: updated });
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-6 text-neutral-500 text-xs">
                                            No characters generated yet. Compile a script to populate this list dynamically!
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SETTINGS TAB */}
                    {activeTab === 'settings' && (
                        <div className="space-y-6 max-w-3xl">
                            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl shadow-lg space-y-6">
                                <h2 className="text-xl font-bold text-white mb-1">Global Pipeline Configuration</h2>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-mono text-neutral-400 block mb-1.5 font-semibold">OpenRouter API Key</label>
                                        <input 
                                            type="password" 
                                            placeholder="sk-or-v1-..."
                                            className="w-full bg-neutral-950 border border-neutral-850 focus:border-blue-500 p-3.5 rounded-xl text-neutral-200 outline-none font-mono text-sm"
                                            value={apiKey}
                                            onChange={(e) => {
                                                setApiKey(e.target.value);
                                                saveConfig({ apiKey: e.target.value });
                                            }}
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-mono text-neutral-400 block mb-1.5 font-semibold">Pipeline Orchestrator Model</label>
                                        <div className="flex gap-2">
                                            <select 
                                                className="flex-1 bg-neutral-950 border border-neutral-855 focus:border-blue-500 p-3.5 rounded-xl text-neutral-200 outline-none font-mono text-sm"
                                                value={model}
                                                onChange={(e) => {
                                                    setModel(e.target.value);
                                                    saveConfig({ model: e.target.value });
                                                }}
                                            >
                                                <option value="deepseek/deepseek-chat">deepseek/deepseek-chat (DeepSeek V3 / V4 Flash equivalent)</option>
                                                <option value="google/gemini-2.5-flash">google/gemini-2.5-flash</option>
                                                <option value="google/gemini-2.5-pro">google/gemini-2.5-pro</option>
                                                <option value="meta-llama/llama-3.1-70b-instruct">meta-llama/llama-3.1-70b-instruct</option>
                                            </select>
                                            <input 
                                                type="text" 
                                                placeholder="Custom model..."
                                                className="bg-neutral-950 border border-neutral-850 focus:border-blue-500 p-3.5 rounded-xl text-neutral-200 outline-none font-mono text-sm w-1/3"
                                                value={model}
                                                onChange={(e) => {
                                                    setModel(e.target.value);
                                                    saveConfig({ model: e.target.value });
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-mono text-neutral-400 block mb-1.5 font-semibold">Safe Output Path Directory</label>
                                        <input 
                                            type="text" 
                                            placeholder="E:/doodleyt/output"
                                            className="w-full bg-neutral-950 border border-neutral-850 focus:border-blue-500 p-3.5 rounded-xl text-neutral-200 outline-none font-mono text-sm"
                                            value={outputPath}
                                            onChange={(e) => {
                                                setOutputPath(e.target.value);
                                                saveConfig({ outputPath: e.target.value });
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-neutral-800 flex justify-end">
                                    <button 
                                        onClick={() => {
                                            saveConfig({ apiKey, model, outputPath, characters });
                                            alert('Settings locked successfully!');
                                        }}
                                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition"
                                    >
                                        Save Config Properties
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* ENLARGED PREVIEW MODAL */}
            {activePreviewPrompt && (
                <div 
                    className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50 transition-opacity"
                    onClick={() => setActivePreviewPrompt('')}
                >
                    <div 
                        className="bg-white text-black p-8 rounded-3xl w-full max-w-xl shadow-2xl relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button 
                            onClick={() => setActivePreviewPrompt('')}
                            className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600 text-xl font-bold font-mono"
                        >
                            ✕
                        </button>
                        <h4 className="text-xs uppercase font-mono font-bold tracking-widest text-neutral-500 mb-4">Stateless Sketch Preview</h4>
                        <div className="border border-neutral-250 rounded-2xl p-4 bg-neutral-50 mb-6">
                            <DoodlePreview prompt={activePreviewPrompt} characters={currentScript?.characters || characters} />
                        </div>
                        <div className="space-y-2">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest font-mono block">Image Prompt String</span>
                            <p className="text-sm text-neutral-800 leading-relaxed font-mono bg-neutral-50 p-4 rounded-xl border border-neutral-200">{activePreviewPrompt}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
