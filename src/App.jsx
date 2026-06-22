import React, { useState, useEffect, useRef } from 'react';

// --- PRESETS & HARDCODED BLUEPRINTS ---
const DEFAULT_TOPICS = [
    { id: 1, title: "Your Teeth Weren't Meant For Modern Food", cat: "Evolutionary Anthropology", curiosity: 9.8, novelty: 9.6, relatability: 9.4, hook: "Why ancient human skulls show perfect straight teeth and zero wisdom teeth impactions before agriculture." },
    { id: 2, title: "Why Complete Silence Terrifies the Human Brain", cat: "Behavioral Psychology", curiosity: 9.9, novelty: 9.7, relatability: 9.2, hook: "Inside the world's quietest room, the silence is so absolute that you start hearing your own organs grinding." },
    { id: 3, title: "Why Left-Handed Spies Were Banned in the 1960s", cat: "Biological Anomalies", curiosity: 9.8, novelty: 9.8, relatability: 8.8, hook: "How an obscure biological trait became an instant automatic dealbreaker for Cold War spy agencies." },
    { id: 4, title: "Before Fire, Every Night Was a Nightmare", cat: "Existential Mysteries", curiosity: 9.7, novelty: 9.5, relatability: 9.0, hook: "How the discovery of fire saved early humans from the terrifying nocturnal predators that ruled the prehistoric dark." },
    { id: 5, title: "Why Ancient Builders Buried Gobekli Tepe Under Dirt", cat: "Archaeological Mysteries", curiosity: 9.8, novelty: 9.6, relatability: 8.5, hook: "Why the world's oldest temple was deliberately buried under thousands of tons of soil by its own creators." },
    { id: 6, title: "The Primal Switch That Flips When You Get Lost", cat: "Survival Psychology", curiosity: 9.6, novelty: 9.4, relatability: 8.9, hook: "Why lost hikers walk in perfect circles, even when they are convinced they are walking straight." },
    { id: 7, title: "The Town That Danced Themselves to Death in 1518", cat: "Mass Hysteria", curiosity: 9.9, novelty: 9.8, relatability: 8.7, hook: "What happens when a mass psychological outbreak causes an entire city to dance uncontrollably until their hearts fail." },
    { id: 8, title: "The 1-Character Code Typo That Wiped Out $500M", cat: "Technological Blunders", curiosity: 9.8, novelty: 9.7, relatability: 9.0, hook: "How a junior developer forgot a reentrancy guard, draining a massive decentralized vault in less than a minute." },
    { id: 9, title: "The Wow Signal and the Fermi Paradox", cat: "Cosmic Anomalies", curiosity: 9.9, novelty: 9.8, relatability: 8.4, hook: "What scientists actually discovered when they analyzed the deep space radio signal that broke cosmic silence." },
    { id: 10, title: "The Medieval Trials Where Rats Were Put on Trial", cat: "Psychology of Beliefs", curiosity: 9.7, novelty: 9.8, relatability: 8.6, hook: "How medieval courts legally prosecuted, tried, and executed weasels, pigs, and insects for crimes." }
];

const BANNED_PRONOUNS = ['he', 'she', 'it', 'they', 'his', 'her', 'their', 'its', 'same', 'similar', 'previous', 'earlier', 'above', 'below', 'again', 'identical', 'character', 'figure'];

const CONSTITUTION = {
    visualDNA: "Crude hand-drawn MS Paint stickman illustrations. Crisp black outlines, stark white backgrounds, minimal color fills (flat colors only), highly exaggerated comic emotions, and bold text overlays. No smooth shading, no gradients, no 3D elements. Low-quality drawings are part of the humor and branding.",
    styleReferences: ['18154.jpg', '18153.jpg', '18152.jpg', '18142.jpg', '18146.jpg', '18143.jpg', '18147.jpg', '18151.jpg', '18149.jpg', '18159.jpg']
};


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
    const [falApiKey, setFalApiKey] = useState('');
    const [elevenlabsApiKey, setElevenlabsApiKey] = useState('');
    const [model, setModel] = useState('deepseek/deepseek-v4-flash');
    const [outputPath, setOutputPath] = useState('');
    const [characters, setCharacters] = useState([]);
    const [videoType, setVideoType] = useState('long');
    const [targetDuration, setTargetDuration] = useState(8); // target in minutes (2, 5, 8, 10, 12)
    
    const [topicBank, setTopicBank] = useState(DEFAULT_TOPICS);
    const [customNicheInput, setCustomNicheInput] = useState('');
    const [selectedTopic, setSelectedTopic] = useState(DEFAULT_TOPICS[0]);
    
    const [pipelineLogs, setPipelineLogs] = useState([]);
    const [currentScript, setCurrentScript] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [synthesisStatus, setSynthesisStatus] = useState('idle');
    const [compileStatus, setCompileStatus] = useState('idle');
    const [serverStatus, setServerStatus] = useState('Checking...');
    
    // Multi-Agent Pipeline Status Checklist (Dynamically built based on length)
    const buildDefaultStages = (type, duration) => {
        const list = [{ id: 'design', label: '1. Niche & Custom Character Design', status: 'idle' }];
        const numActs = type === 'short' ? 1 : duration;
        for (let i = 1; i <= numActs; i++) {
            list.push({ id: `act${i}`, label: `${i + 1}. Drafting Act ${i} (Scenes ${(i-1)*20 + 1}-${i*20})`, status: 'idle' });
        }
        list.push({ id: 'qc', label: `${numActs + 2}. Stateless QC Check & Auto-Sanitation`, status: 'idle' });
        return list;
    };

    const [pipelineStages, setPipelineStages] = useState([]);

    useEffect(() => {
        setPipelineStages(buildDefaultStages(videoType, targetDuration));
    }, [videoType, targetDuration]);

    const [activePreviewPrompt, setActivePreviewPrompt] = useState('');
    const [qcTestText, setQcTestText] = useState('');
    const logEndRef = useRef(null);

    // Fetch config on load
    useEffect(() => {
        fetch('/api/config')
            .then(res => res.json())
            .then(data => {
                setServerStatus('Online');
                if (data.apiKey) setApiKey(data.apiKey);
                if (data.falApiKey) setFalApiKey(data.falApiKey);
                if (data.elevenlabsApiKey) setElevenlabsApiKey(data.elevenlabsApiKey);
                if (data.model) setModel(data.model);
                if (data.outputPath) setOutputPath(data.outputPath);
                if (data.characters) setCharacters(data.characters);
            })
            .catch(err => {
                console.log('Client-only mode (offline)');
                setServerStatus('Offline (Client-Only)');
                
                const cachedKey = localStorage.getItem('doodleyt_api_key') || '';
                const cachedFalKey = localStorage.getItem('doodleyt_fal_key') || '';
                const cachedElevenlabsKey = localStorage.getItem('doodleyt_elevenlabs_key') || '';
                const cachedModel = localStorage.getItem('doodleyt_model') || 'deepseek/deepseek-v4-flash';
                const cachedPath = localStorage.getItem('doodleyt_output_path') || 'E:/doodleyt/output';
                const cachedChars = localStorage.getItem('doodleyt_characters');

                setApiKey(cachedKey);
                setFalApiKey(cachedFalKey);
                setElevenlabsApiKey(cachedElevenlabsKey);
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
        if (updatedFields.falApiKey !== undefined) localStorage.setItem('doodleyt_fal_key', updatedFields.falApiKey);
        if (updatedFields.elevenlabsApiKey !== undefined) localStorage.setItem('doodleyt_elevenlabs_key', updatedFields.elevenlabsApiKey);
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

    // Brainstorms 10 viral ideas covering all core categories
    const generateTopicsViaAI = async () => {
        if (!apiKey) {
            alert('Please set your OpenRouter API Key in settings first!');
            return;
        }
        addLog('Inquiring OpenRouter for 10 extremely niche, viral brainstorm matrices...');
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
                            content: `Generate exactly 10 fresh, high-click, curiosity-driven viral video topics for the YouTube channel 'Doodle Theory'.
The channel focuses strictly on these 10 core categories, and you must generate exactly one topic per category:
1. Evolutionary Anthropology & Ancient Human History (e.g. how ancient humans slept, hunted, survived, why fire feels different, how we flirted before language, why wild predators feared us).
2. Behavioral Psychology & Famous Social Experiments (e.g. Rat Park, Calhoun's Universe 25, the Spotlight Effect, the Pratfall Effect, traits of introverts/loners).
3. Biological Anomalies & Human Body Mysteries (e.g. baby amnesia, left/right handedness, blood type differences, teeth and modern food mismatch, what complete silence does to the brain).
4. Existential, Cognitive & Scientific Mysteries (e.g. sensory deprivation hallucinations, what did ancient humans do at night, what happens after we die, are we dumber than our grandparents).
5. Archaeological Mysteries & Lost Civilizations (e.g. Gobekli Tepe anomalies, why the Bronze Age collapsed, unexplained ancient engineering).
6. Survival Psychology & Extreme Environment Biology (e.g. reacting to freezing isolation, Neanderthal Ice Age survival, the cognitive psychology of getting lost).
7. Bizarre Historical Events & Mass Hysteria (e.g. the Dancing Plague of 1518, the Dyatlov Pass incident, weird historical coincidences).
8. Military & Technological Blunders (e.g. the code typo that sank a submarine, how a nation lost a war to emus/birds, history's most expensive engineering mistakes).
9. Existential Space & Cosmic Anomalies (e.g. the Wow! Signal, the Fermi Paradox, falling into a black hole).
10. Psychology of Beliefs & Secret Societies (e.g. mass hysteria/witch trials, how ancient secret orders functioned).

TITLE GENERATION LAWS (Strictly Enforced):
- Short & Striking: Length must be 5 to 9 words maximum.
- Curiosity Gap Formula: Withhold the core secret, answer, or resolution. (e.g. "Why Complete Silence Terrifies the Human Brain", "The Hidden Trait That Made Humans Feared by Animals", "The Only Predator That Had No Natural Weapon and Won").
- Provocative Addressing: Speak directly to the viewer. (e.g. "Ancient Humans Were Stronger Than You", "Your Teeth Weren't Meant For Modern Food").
- Survival/Primal Shock: Highlight deep ancestral fears. (e.g. "Before Fire, Every Night Was a Nightmare", "Why Predators Ignored Sleeping Ancient Humans").
- Formatting: Use standard lowercase/sentence case. Never use ending punctuation (no exclamation/question marks) or clickbait emojis. Keep it short, mysterious, and highly clickable.

For each topic, evaluate and assign scores (0-10) for Curiosity, Novelty, and Relatability.
Also write a brief 1-sentence hook statement for each.

Output strictly as a JSON array inside a code block, formatted like this:
[
  {"id": 301, "title": "short curiosity gap title", "cat": "Category Name", "curiosity": 9.9, "novelty": 9.8, "relatability": 9.1, "hook": "Bizarre hook sentence"}
]
Generate exactly 10 items, one for each category.`
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
                addLog(`Successfully parsed ${parsed.length} new brainstorm topics covering all 10 categories.`);
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
        
        // Reset dynamic stages to idle status
        setPipelineStages(prev => prev.map(s => ({ ...s, status: 'idle' })));
        
        const numActs = videoType === 'short' ? 1 : targetDuration;
        
        let accumulatedScenes = [];
        let finalScriptData = { title: '', category: '', nicheReason: '', thumbnail: '', characters: [] };
        
        addLog(`⚙️ Booting Dynamic Multistage Pipeline Orchestrator...`);
        addLog(`🧠 Target Model: ${model}`);
        addLog(`🎬 Mode: ${videoType.toUpperCase()} | Target Length: ${videoType === 'short' ? 'Short (~1 min)' : `${targetDuration} min (${numActs * 20} scenes)`}`);

        try {
            // ==========================================
            // STAGE 1: Niche & Custom Character Design
            // ==========================================
            updateStageStatus('design', 'running');
            addLog(`⚡ Starting Stage 1: Autonomous Niche & Character Design...`);

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

            const charactersListString = finalScriptData.characters.map(c => `- **${c.name}**: ${c.description}`).join('\n');
            const charactersPromptGuide = `Stateless Prompt Rule (THE GOLDEN RULE):
Image generators have no memory. You must never use character names alone and never use pronouns (he, she, it, they, his, her, their, its, same, previous, earlier, above, below, again, character, figure).
Always start the prompt with: "A crude MS Paint stickman doodle with black outlines and flat colors on a white background. [Describe character physical appearance] is [describe specific action/pose/emotion] [describe scene context/objects]."

Character presets to use:
${charactersListString}`;

            // ==========================================
            // LOOP THROUGH DYNAMIC ACTS
            // ==========================================
            for (let j = 1; j <= numActs; j++) {
                const stageId = `act${j}`;
                updateStageStatus(stageId, 'running');
                addLog(`⚡ Starting Stage ${j + 1}: Drafting Act ${j} of ${numActs} (scenes ${(j-1)*20 + 1}-${j*20})...`);

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

                const actUserPrompt = `Write ${actTitleText} (scenes ${(j-1)*20 + 1}-${j*20}) for the video: "${finalScriptData.title}".
Niche context: ${finalScriptData.nicheReason}
${actFocusText}

Last spoken lines of previous section: "${lastVoContext}"

${charactersPromptGuide}

SCRIPTWRITING & PACING LAWS:
1. Pacing & Timing: Keep each scene duration between 1 to 3 seconds. Spoken voiceover sentences must be short, conversational, and punchy.
2. Aspect Ratio: The layout format is ${videoType === 'short' ? '9:16 vertical portrait format' : '16:9 widescreen landscape format'}. Make sure all visual prompts specify this format (e.g. ${videoType === 'short' ? '"9:16 vertical portrait layout"' : '"16:9 widescreen landscape layout"'}).
3. Dynamic Action Prompts: In the "prompt" field, you must write a unique, detailed description of the scene's action. Follow the Stateless Prompt Rule. Never output the exact same visual prompt for different scenes.
4. Capitalized Text Overlay: Every 3-4 scenes, add a short, high-impact text overlay in the "textOverlay" field. Leave null for other scenes.

Generate exactly 20 consecutive scenes starting from scene number ${(j-1)*20 + 1}.

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

                const actResponse = await callOpenRouter(actSystemPrompt, actUserPrompt);
                const actJsonMatch = actResponse.match(/\{[\s\S]*\}/);
                if (!actJsonMatch) throw new Error(`Stage ${j + 1} (Act ${j}) failed to return JSON.`);
                
                const actData = JSON.parse(actJsonMatch[0]);
                accumulatedScenes = [...accumulatedScenes, ...actData.scenes];
                addLog(`✓ Act ${j} compiled successfully (${actData.scenes.length} scenes).`);
                updateStageStatus(stageId, 'completed');
            }

            // ==========================================
            // STAGE 6: Local Stateless QC Check
            // ==========================================
            updateStageStatus('qc', 'running');
            addLog(`⚡ Starting final Quality Control & Stateless Guardrail analysis...`);

            let qcErrorsCount = 0;
            const finalScenes = accumulatedScenes.map((scene, idx) => {
                const check = validatePromptText(scene.prompt);
                const sceneTime = formatTime(accumulatedScenes.slice(0, idx).reduce((acc, s) => acc + (s.duration || 2), 0));
                
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
            setPipelineStages(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'failed' } : s));
        } finally {
            setIsGenerating(false);
        }
        setSynthesisStatus('running');
        addLog('⚡ Launching media asset synthesis pipeline (images & audio)...');
        addLog(`🔑 Using configuration: Fal.ai (${falApiKey ? 'Provided' : 'Mock Fallback'}), ElevenLabs (${elevenlabsApiKey ? 'Provided' : 'Mock Fallback'})`);
        
        try {
            const response = await fetch('/api/synthesize-assets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scenes: currentScript.scenes,
                    falApiKey,
                    elevenlabsApiKey,
                    outputPath
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || `HTTP ${response.status}`);
            }

            const data = await response.json();
            addLog(`✅ Asset synthesis completed successfully!`);
            addLog(`📁 Images written to: ${data.imagesDir}`);
            addLog(`📁 Audio written to: ${data.audioDir}`);
            setSynthesisStatus('completed');
        } catch (e) {
            addLog(`❌ Synthesis pipeline failed: ${e.message}`);
            setSynthesisStatus('failed');
        }
    };

    const runVideoCompilation = async () => {
        if (!currentScript) return;
        setCompileStatus('running');
        addLog('🎬 Launching FFmpeg compiler stitching routine...');
        
        try {
            const response = await fetch('/api/assemble-video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scenes: currentScript.scenes,
                    outputPath
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || `HTTP ${response.status}`);
            }

            const data = await response.json();
            addLog(`🎉 Video render completed! Final MP4 size: ${data.fileSize} bytes.`);
            addLog(`💾 Saved final video file to: ${data.filePath}`);
            setCompileStatus('completed');
        } catch (e) {
            addLog(`❌ Video compilation failed: ${e.message}`);
            setCompileStatus('failed');
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

    const handleCellEdit = (index, field, value) => {
        if (!currentScript) return;
        setCurrentScript(prev => {
            const newScenes = [...prev.scenes];
            newScenes[index] = {
                ...newScenes[index],
                [field]: value
            };
            if (field === 'duration') {
                let currentAccumulatedTime = 0;
                newScenes.forEach((s, idx) => {
                    s.time = formatTime(currentAccumulatedTime);
                    currentAccumulatedTime += s.duration;
                });
            }
            if (field === 'prompt') {
                const check = validatePromptText(value);
                newScenes[index].qcErrors = check.words;
            }
            return { ...prev, scenes: newScenes };
        });
    };

    const saveScriptToDisk = async (format) => {
        if (!currentScript) {
            alert('No script to save!');
            return;
        }

        const baseFilename = currentScript.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const filename = `${baseFilename}_blueprint.${format}`;
        let content = '';

        if (format === 'json') {
            content = JSON.stringify(currentScript, null, 2);
        } else if (format === 'csv') {
            const headers = ['Time', 'Duration', 'Voiceover Script', 'SFX', 'Camera', 'Stateless Visual Prompt', 'Overlay'];
            const rows = currentScript.scenes.map(s => [
                s.time || '',
                s.duration || '',
                s.voiceover || '',
                s.sfx || '',
                s.camera || '',
                s.prompt || '',
                s.textOverlay || ''
            ]);
            const escapeCsv = (val) => {
                if (val === null || val === undefined) return '';
                const str = String(val);
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            };
            content = [
                headers.join(','),
                ...rows.map(r => r.map(escapeCsv).join(','))
            ].join('\n');
        }

        addLog(`💾 Attempting to save script as ${format.toUpperCase()}...`);

        try {
            const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            addLog(`✓ Browser download triggered for: ${filename}`);
        } catch (err) {
            console.error('Browser download failed', err);
        }

        if (!serverStatus.includes('Offline')) {
            try {
                const response = await fetch('/api/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename, content })
                });
                const resData = await response.json();
                if (resData.success) {
                    addLog(`✓ Saved to local disk output directory: ${resData.filePath}`);
                    alert(`Script saved successfully!\n\n1. Downloaded in browser\n2. Saved locally to: ${resData.filePath}`);
                } else {
                    throw new Error(resData.error || 'Server rejected save');
                }
            } catch (e) {
                addLog(`⚠️ Local server save failed: ${e.message}`);
            }
        } else {
            alert(`Script downloaded successfully via browser!\n(Local server offline, skipped server sync)`);
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
                        <button onClick={() => setActiveTab('visual')} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all ${activeTab === 'visual' ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white border border-transparent'}`}>
                            <span>🎨</span> Visual DNA Registry
                        </button>
                        <button onClick={() => setActiveTab('qc')} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all ${activeTab === 'qc' ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white border border-transparent'}`}>
                            <span>🛡️</span> QC & Stateless Guardrails
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

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                    <div>
                                        <label className="text-xs font-semibold text-neutral-400 block font-mono mb-2">Video Format / Type</label>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => setVideoType('long')}
                                                className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 ${videoType === 'long' ? 'bg-blue-600/10 border-blue-500/30 text-blue-400 font-bold' : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'}`}
                                            >
                                                <span>🎥</span> Long Form (16:9)
                                            </button>
                                            <button 
                                                onClick={() => setVideoType('short')}
                                                className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 ${videoType === 'short' ? 'bg-blue-600/10 border-blue-500/30 text-blue-400 font-bold' : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'}`}
                                            >
                                                <span>📱</span> Shorts/Reels (9:16)
                                            </button>
                                        </div>
                                    </div>

                                    {videoType === 'long' && (
                                        <div>
                                            <label className="text-xs font-semibold text-neutral-400 block font-mono mb-2">Target Duration (Minutes)</label>
                                            <select
                                                value={targetDuration}
                                                onChange={(e) => setTargetDuration(parseInt(e.target.value))}
                                                className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-3.5 rounded-xl text-xs text-neutral-200 outline-none font-mono"
                                            >
                                                <option value={2}>2 Minutes (~40 scenes)</option>
                                                <option value={5}>5 Minutes (~100 scenes)</option>
                                                <option value={8}>8 Minutes (~160 scenes)</option>
                                                <option value={10}>10 Minutes (~200 scenes)</option>
                                                <option value={12}>12 Minutes (~240 scenes)</option>
                                            </select>
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

                                                {/* ASSET SYNTHESIS & RENDERING CONTROLS */}
                                                <div className="bg-neutral-950 border border-neutral-850 p-5 rounded-2xl mb-4 space-y-4 shadow-inner">
                                                    <div className="flex justify-between items-center">
                                                        <div>
                                                            <h4 className="text-xs font-bold font-mono text-neutral-350 uppercase tracking-wide">Autonomous Production Control</h4>
                                                            <p className="text-[10px] text-neutral-500 mt-0.5">Synthesize script media assets, then stitch them into an MP4 video.</p>
                                                        </div>
                                                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${synthesisStatus === 'idle' ? 'bg-neutral-905 text-neutral-500' : synthesisStatus === 'running' ? 'bg-blue-900/30 text-blue-400 border border-blue-800/30 animate-pulse' : synthesisStatus === 'completed' ? 'bg-green-950/20 text-green-400 border border-green-900/30' : 'bg-red-950/20 text-red-400 border border-red-900/30'}`}>
                                                            {synthesisStatus === 'idle' ? 'Ready' : synthesisStatus === 'running' ? 'Synthesizing...' : synthesisStatus === 'completed' ? 'Assets Ready' : 'Synthesis Failed'}
                                                        </span>
                                                    </div>

                                                    <div className="flex flex-col sm:flex-row gap-3">
                                                        <button
                                                            onClick={runAssetSynthesis}
                                                            disabled={isGenerating || synthesisStatus === 'running'}
                                                            className="flex-1 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 hover:border-neutral-700 disabled:opacity-50 text-neutral-200 hover:text-white font-semibold py-3 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2"
                                                        >
                                                            <span>🎨</span> Synthesize Media Assets (Fal.ai & ElevenLabs)
                                                        </button>

                                                        <button
                                                            onClick={runVideoCompilation}
                                                            disabled={isGenerating || synthesisStatus !== 'completed' || compileStatus === 'running'}
                                                            className="flex-1 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 hover:border-blue-500/40 text-blue-400 hover:text-blue-300 font-semibold py-3 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
                                                        >
                                                            <span>🎬</span> Assemble Final Video (FFmpeg Compiler)
                                                        </button>
                                                    </div>

                                                    {compileStatus === 'completed' && (
                                                        <div className="bg-green-950/10 border border-green-500/20 text-green-400 p-3 rounded-xl text-[10px] font-mono flex items-center justify-between">
                                                            <span>🎉 MP4 Render successful! Saved in Safe Output Directory.</span>
                                                        </div>
                                                    )}
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
                                        <label className="text-xs font-mono text-neutral-400 block mb-1.5 font-semibold">Fal.ai API Key (Image Generation)</label>
                                        <input 
                                            type="password" 
                                            placeholder="fal-..."
                                            className="w-full bg-neutral-950 border border-neutral-850 focus:border-blue-500 p-3.5 rounded-xl text-neutral-200 outline-none font-mono text-sm"
                                            value={falApiKey}
                                            onChange={(e) => {
                                                setFalApiKey(e.target.value);
                                                saveConfig({ falApiKey: e.target.value });
                                            }}
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-mono text-neutral-400 block mb-1.5 font-semibold">ElevenLabs API Key (Voiceover TTS)</label>
                                        <input 
                                            type="password" 
                                            placeholder="eleven-labs-key..."
                                            className="w-full bg-neutral-950 border border-neutral-850 focus:border-blue-500 p-3.5 rounded-xl text-neutral-200 outline-none font-mono text-sm"
                                            value={elevenlabsApiKey}
                                            onChange={(e) => {
                                                setElevenlabsApiKey(e.target.value);
                                                saveConfig({ elevenlabsApiKey: e.target.value });
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
                                                <option value="deepseek/deepseek-v4-flash">deepseek/deepseek-v4-flash (DeepSeek V4 Flash - Recommended)</option>
                                                <option value="deepseek/deepseek-chat">deepseek/deepseek-chat (DeepSeek V3)</option>
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

                    {/* VISUAL DNA REGISTRY TAB */}
                    {activeTab === 'visual' && (
                        <div className="space-y-6 max-w-5xl animate-fadeIn">
                            {/* Header Banner */}
                            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl shadow-lg relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
                                <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                                    <span>🎨</span> Visual DNA Registry
                                </h2>
                                <p className="text-sm text-neutral-400 font-medium">Global visual parameters and style reference guides locked into the generative core system by the Doodle Theory Constitution.</p>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Left Side: Style Anchor DNA */}
                                <div className="lg:col-span-2 space-y-6">
                                    <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl shadow-lg space-y-4">
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-xs uppercase tracking-widest font-mono text-neutral-400 font-semibold">Style DNA Anchor String</h3>
                                            <span className="bg-blue-900/30 text-blue-400 border border-blue-800/30 text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase">Locked</span>
                                        </div>
                                        <p className="text-xs text-neutral-400">This prefix string is appended to every single visual scene prompt prior to image synthesis, forcing Stable Diffusion / Midjourney seeds to stay strictly on-brand.</p>
                                        <div className="bg-neutral-950 p-5 rounded-2xl border border-neutral-800 text-sm font-mono text-neutral-300 leading-relaxed relative group">
                                            {CONSTITUTION.visualDNA}
                                            <button 
                                                onClick={() => {
                                                    navigator.clipboard.writeText(CONSTITUTION.visualDNA);
                                                    alert('Visual DNA copied to clipboard!');
                                                }}
                                                className="absolute bottom-3 right-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5"
                                            >
                                                📋 Copy
                                            </button>
                                        </div>
                                    </div>

                                    {/* Linked System Assets */}
                                    <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl shadow-lg space-y-4">
                                        <h3 className="text-xs uppercase tracking-widest font-mono text-neutral-400 font-semibold">System Seed Reference Images</h3>
                                        <p className="text-xs text-neutral-400">These asset identifier files are referenced in prompt embeddings to trigger specific MS Paint stickman style checkpoints.</p>
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {CONSTITUTION.styleReferences.map((ref, idx) => (
                                                <div key={ref} className="bg-neutral-950 border border-neutral-850 p-4 rounded-2xl flex items-center justify-between hover:border-blue-500/30 transition-all group">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-lg font-bold group-hover:scale-105 transition-transform">
                                                            🖼️
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-mono font-bold text-white">{ref}</div>
                                                            <div className="text-[10px] text-neutral-500 font-mono">Index Reference: #{idx + 1}</div>
                                                        </div>
                                                    </div>
                                                    <span className="bg-green-950/20 text-green-400 border border-green-900/30 text-[9px] font-mono px-2 py-0.5 rounded uppercase">Active</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Side: Visual Constraints Overview */}
                                <div className="space-y-6">
                                    <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl shadow-lg space-y-4">
                                        <h3 className="text-xs uppercase tracking-widest font-mono text-neutral-400 font-semibold">Style Rule Checks</h3>
                                        <div className="space-y-3.5">
                                            <div className="flex gap-3">
                                                <span className="text-green-400 mt-0.5">✓</span>
                                                <div>
                                                    <h4 className="text-xs font-bold text-neutral-200 font-mono">Solid White Backgrounds</h4>
                                                    <p className="text-[11px] text-neutral-400 mt-0.5">Ensures crisp rendering and high contrast against black outlines.</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-3">
                                                <span className="text-green-400 mt-0.5">✓</span>
                                                <div>
                                                    <h4 className="text-xs font-bold text-neutral-200 font-mono">Thin Black Outlines</h4>
                                                    <p className="text-[11px] text-neutral-400 mt-0.5">Mimics the classic MS Paint default pencil/brush tool aesthetic.</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-3">
                                                <span className="text-green-400 mt-0.5">✓</span>
                                                <div>
                                                    <h4 className="text-xs font-bold text-neutral-200 font-mono">Flat Colors Only</h4>
                                                    <p className="text-[11px] text-neutral-400 mt-0.5">Strictly prohibits gradients, shadows, lighting, or 3D textures.</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-3">
                                                <span className="text-green-400 mt-0.5">✓</span>
                                                <div>
                                                    <h4 className="text-xs font-bold text-neutral-200 font-mono">Extreme Cartoon Expressions</h4>
                                                    <p className="text-[11px] text-neutral-400 mt-0.5">Exaggerated mouths, sweat drops, and popping eyes represent the core humor.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-neutral-900 border border-neutral-850 p-6 rounded-3xl shadow-lg space-y-4">
                                        <h3 className="text-xs uppercase tracking-widest font-mono text-neutral-400 font-semibold">Active Scene Preview</h3>
                                        <div className="bg-neutral-950 border border-neutral-850 p-4 rounded-2xl flex flex-col items-center justify-center text-center py-8">
                                            <div className="w-16 h-16 rounded-full bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-2xl mb-3">
                                                🎨
                                            </div>
                                            <p className="text-xs text-neutral-400 max-w-[200px] mb-4">Click "Script Sandbox" or "Execution Terminal" to see and edit dynamic preview drawings.</p>
                                            <button 
                                                onClick={() => setActiveTab('sandbox')}
                                                className="bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-200 hover:text-white px-4 py-2 rounded-xl text-xs font-semibold transition"
                                            >
                                                Open Sandbox
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STATELESS QC GUARDRAILS TAB */}
                    {activeTab === 'qc' && (
                        <div className="space-y-6 max-w-5xl animate-fadeIn">
                            {/* Header Banner */}
                            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl shadow-lg relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-3xl pointer-events-none"></div>
                                <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                                    <span>🛡️</span> QC & Stateless Guardrails
                                </h2>
                                <p className="text-sm text-neutral-400 font-medium">Dynamically shields image prompts from context memory failure by banning and stripping relative reference words.</p>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Left Side: Absolute Ban List */}
                                <div className="lg:col-span-2 space-y-6">
                                    <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl shadow-lg space-y-4">
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-xs uppercase tracking-widest font-mono text-neutral-400 font-semibold">Absolute Banned Word Signatures</h3>
                                            <span className="bg-red-900/30 text-red-400 border border-red-800/30 text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase">Enforced</span>
                                        </div>
                                        <p className="text-xs text-neutral-400">If any of these pronouns or relative references leak into a visual prompt, the image generator will fail to compile the character correctly. Our guardrail system catches and flags them immediately.</p>
                                        
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                            {BANNED_PRONOUNS.map((word) => (
                                                <div key={word} className="bg-neutral-950 border border-neutral-850/80 p-3 rounded-xl flex flex-col justify-between hover:border-red-500/20 transition-all font-mono">
                                                    <span className="text-red-400 text-xs font-bold font-mono">"{word}"</span>
                                                    <span className="text-[9px] text-neutral-600 uppercase mt-1">Blocked Pattern</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Live QC Playground */}
                                    <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl shadow-lg space-y-4">
                                        <h3 className="text-xs uppercase tracking-widest font-mono text-neutral-400 font-semibold">Interactive Playground: Prompt Sanitizer</h3>
                                        <p className="text-xs text-neutral-400">Type or paste a draft visual prompt below to test if it violates the stateless design rule.</p>
                                        
                                        <div className="space-y-4">
                                            <textarea 
                                                value={qcTestText}
                                                onChange={(e) => setQcTestText(e.target.value)}
                                                placeholder="e.g. A crude stickman doodle of Bob holding a pen. He is smiling while he looks at the camera again..."
                                                rows="3"
                                                className="w-full bg-neutral-950 border border-neutral-800 focus:border-red-500 focus:ring-1 focus:ring-red-500/20 p-4 rounded-2xl text-sm text-neutral-200 outline-none font-mono resize-none transition-all"
                                            />
                                            
                                            {qcTestText && (
                                                <div className={`p-4 rounded-2xl border ${validatePromptText(qcTestText).isValid ? 'bg-green-950/10 border-green-500/20 text-green-400' : 'bg-red-950/10 border-red-500/20 text-red-400'} font-mono text-xs space-y-2`}>
                                                    <div className="flex items-center gap-2 font-bold uppercase tracking-wider">
                                                        <span>{validatePromptText(qcTestText).isValid ? '✓ Shield Intact' : '⚠ Violation Caught'}</span>
                                                    </div>
                                                    <p className="text-neutral-400 font-sans">
                                                        {validatePromptText(qcTestText).isValid 
                                                            ? 'This prompt does not contain any relative pronouns or memory state words. It is safe for stateless generation!'
                                                            : `Banned terms detected: ${validatePromptText(qcTestText).words.map(w => `"${w}"`).join(', ')}. Please replace them with absolute descriptions.`
                                                        }
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Side: Technical Specs */}
                                <div className="space-y-6">
                                    <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl shadow-lg space-y-4">
                                        <h3 className="text-xs uppercase tracking-widest font-mono text-neutral-400 font-semibold">Why is this critical?</h3>
                                        <div className="text-xs text-neutral-400 space-y-3 leading-relaxed">
                                            <p><strong>Memoryless Generators:</strong> Image generators process each image in total isolation. They do not know what was generated in previous scenes.</p>
                                            <p><strong>The Pronoun Trap:</strong> Saying <em>"He is walking"</em> makes the generator hallucinate a random new character. The name <em>"Bob"</em> alone is not enough either, as "Bob" means nothing to the base model.</p>
                                            <p><strong>The Solution:</strong> The orchestrator automatically parses every character's description card and injects it in place of pronouns. The word <em>"He"</em> is forbidden; instead, we must say: <em>"A crude stickman with red baseball cap and blue hoodie"</em>.</p>
                                        </div>
                                    </div>

                                    <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl shadow-lg space-y-4">
                                        <h3 className="text-xs uppercase tracking-widest font-mono text-neutral-400 font-semibold">Guardrail Metrics</h3>
                                        <div className="space-y-3 font-mono text-xs">
                                            <div className="flex justify-between py-1 border-b border-neutral-800/60">
                                                <span className="text-neutral-500">Scan Level:</span>
                                                <span className="text-white font-bold">Regex Token Match</span>
                                            </div>
                                            <div className="flex justify-between py-1 border-b border-neutral-800/60">
                                                <span className="text-neutral-500">Failure Action:</span>
                                                <span className="text-red-400 font-bold">Block & Regenerate</span>
                                            </div>
                                            <div className="flex justify-between py-1">
                                                <span className="text-neutral-500">Active Ruleset:</span>
                                                <span className="text-blue-400 font-bold">Doodle Theory v1.2</span>
                                            </div>
                                        </div>
                                    </div>
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
