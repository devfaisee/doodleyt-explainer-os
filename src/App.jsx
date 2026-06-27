import React, { useState, useEffect, useRef } from 'react';
import TerminalView from './components/TerminalView';
import TopicsView from './components/TopicsView';
import SandboxView from './components/SandboxView';
import CharactersView from './components/CharactersView';
import SettingsView from './components/SettingsView';
import VisualDNAView from './components/VisualDNAView';
import QCView from './components/QCView';
import VideosView from './components/VideosView';


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
    visualDNA: "Minimalist hand-drawn 2D vector-style cartoon illustration (similar to YouTube channel Zenn). Clean, smooth, non-jagged black felt-pen outlines and solid flat color fills. Exaggerated comical cartoon expressions (wide cartoon eyes, sweating, gaping mouth). Backgrounds are high-contrast and completely flat: solid white, bright solid yellow, deep solid black, or simple flat colored environments (no gradients, no realistic shading, no 3D rendering). Features bold, hand-drawn uppercase text overlays with thick black outlines (typically in bright yellow, red, or white) and clean, hand-drawn red pointing arrows or white speech bubbles where appropriate. Simple, clean, cute cartoon representations of characters, animals, and objects instead of complex or messy sketches. Perfect clean outlines (no messy or pixelated lines, no scribbled draft lines).",
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


const FALLBACK_API_KEY = '';

// --- MAIN APP COMPONENT ---
function App() {
    const [authenticated, setAuthenticated] = useState(false);
    const [passKey, setPassKey] = useState('');
    const [activeTab, setActiveTab] = useState('terminal');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    
    // Core parameters
    const [apiKey, setApiKey] = useState('');
    const [geminiApiKey, setGeminiApiKey] = useState('');
    const [falApiKey, setFalApiKey] = useState('');
    const [elevenlabsApiKey, setElevenlabsApiKey] = useState('');
    const [model, setModel] = useState('deepseek/deepseek-v4-flash');
    const [outputPath, setOutputPath] = useState('');
    const API_SERVER_URL = 'https://doodleyt-explainer-os.onrender.com';

    const apiFetch = (url, options = {}) => {
        const baseUrl = API_SERVER_URL;
        const targetUrl = url.startsWith('/') ? url : `/${url}`;
        return fetch(`${baseUrl}${targetUrl}`, options);
    };

    const getAssetUrl = (path) => {
        if (!path) return '';
        if (path.startsWith('http')) return path;
        const baseUrl = API_SERVER_URL;
        const targetUrl = path.startsWith('/') ? path : `/${path}`;
        return `${baseUrl}${targetUrl}`;
    };
    const [characters, setCharacters] = useState([]);
    const [videoType, setVideoType] = useState('long');
    const [targetDuration, setTargetDuration] = useState(8); // target in minutes (2, 5, 8, 10, 12, 15, 20, 25)
    
    const [visualDNA, setVisualDNA] = useState("Minimalist hand-drawn 2D vector-style cartoon illustration (similar to YouTube channel Zenn). Clean, smooth, non-jagged black felt-pen outlines and solid flat color fills. Exaggerated comical cartoon expressions (wide cartoon eyes, sweating, gaping mouth). Backgrounds are high-contrast and completely flat: solid white, bright solid yellow, deep solid black, or simple flat colored environments (no gradients, no realistic shading, no 3D rendering). Features bold, hand-drawn uppercase text overlays with thick black outlines (typically in bright yellow, red, or white) and clean, hand-drawn red pointing arrows or white speech bubbles where appropriate. Simple, clean, cute cartoon representations of characters, animals, and objects instead of complex or messy sketches. Perfect clean outlines (no messy or pixelated lines, no scribbled draft lines).");
    const [styleReferences, setStyleReferences] = useState(['18154.jpg', '18153.jpg', '18152.jpg', '18142.jpg', '18146.jpg', '18143.jpg', '18147.jpg', '18151.jpg', '18149.jpg', '18159.jpg']);
    
    const [topicBank, setTopicBank] = useState(DEFAULT_TOPICS);
    const [customNicheInput, setCustomNicheInput] = useState('');
    const [selectedTopic, setSelectedTopic] = useState(DEFAULT_TOPICS[0]);
    
    const [pipelineLogs, setPipelineLogs] = useState([]);
    const [currentScript, setCurrentScript] = useState(() => {
        try {
            const cached = localStorage.getItem('doodleyt_current_script');
            return cached ? JSON.parse(cached) : null;
        } catch (e) {
            console.error('Failed to parse cached script', e);
            return null;
        }
    });

    // Script History state
    const [scriptHistory, setScriptHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [activeHistoryFilename, setActiveHistoryFilename] = useState(null);
    const [showHistoryPanel, setShowHistoryPanel] = useState(false);
    const [copiedField, setCopiedField] = useState(null);

    // Copy to clipboard with visual feedback
    const copyToClipboard = (text, fieldId) => {
        navigator.clipboard.writeText(text);
        setCopiedField(fieldId);
        setTimeout(() => setCopiedField(null), 2000);
    };

    useEffect(() => {
        if (currentScript) {
            localStorage.setItem('doodleyt_current_script', JSON.stringify(currentScript));
        } else {
            localStorage.removeItem('doodleyt_current_script');
        }
    }, [currentScript]);

    const [isGenerating, setIsGenerating] = useState(false);
    const [synthesisStatus, setSynthesisStatus] = useState('idle');
    const [compileStatus, setCompileStatus] = useState('idle');
    const [serverStatus, setServerStatus] = useState('Checking...');

    // Debounced sync to server for sandbox script changes
    useEffect(() => {
        if (!currentScript || isGenerating || synthesisStatus === 'running' || compileStatus === 'running') return;
        
        const delayDebounceFn = setTimeout(() => {
            if (serverStatus.includes('Offline')) return;
            // Save to latest_script.json and update history if filename present
            if (currentScript.historyFilename) {
                apiFetch('/api/update-script-history', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename: currentScript.historyFilename, script: currentScript })
                }).catch(e => console.error('Failed to sync script history', e));
            } else {
                apiFetch('/api/save-active-script', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ script: currentScript })
                }).catch(e => console.error('Failed to sync settings', e));
            }
        }, 1500);
        
        return () => clearTimeout(delayDebounceFn);
    }, [currentScript, isGenerating, synthesisStatus, compileStatus, serverStatus]);
    
    // Multi-Agent Pipeline Status Checklist (Dynamically built based on length)
    const buildDefaultStages = (type, duration) => {
        const list = [{ id: 'design', label: '1. Niche & Custom Character Design', status: 'idle' }];
        const numActs = type === 'short' ? 1 : duration;
        for (let i = 1; i <= numActs; i++) {
            list.push({ id: `act${i}`, label: `${i + 1}. Drafting Act ${i} (Dynamic Scenes)`, status: 'idle' });
        }
        list.push({ id: 'qc', label: `${numActs + 2}. Stateless QC Check & Auto-Sanitation`, status: 'idle' });
        return list;
    };

    const [pipelineStages, setPipelineStages] = useState(() => buildDefaultStages(videoType, targetDuration));

    // Keep checklist structure synced with length selection
    useEffect(() => {
        setPipelineStages(buildDefaultStages(videoType, targetDuration));
    }, [videoType, targetDuration]);

    const logEndRef = useRef(null);
    const pollIntervalRef = useRef(null);

    const startPollingStatus = () => {
        if (pollIntervalRef.current) return;
        
        pollIntervalRef.current = setInterval(async () => {
            try {
                const res = await apiFetch('/api/generation-status');
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                
                if (data.logs) setPipelineLogs(data.logs);
                if (data.stages) setPipelineStages(data.stages);
                if (data.script) {
                    setCurrentScript(data.script);
                    if (data.script.historyFilename) setActiveHistoryFilename(data.script.historyFilename);
                }
                
                // Map status according to jobType
                if (data.jobType === 'synthesis') {
                    setSynthesisStatus(data.status);
                    setIsGenerating(false);
                    setCompileStatus('idle');
                } else if (data.jobType === 'assembly') {
                    setCompileStatus(data.status);
                    setIsGenerating(false);
                    setSynthesisStatus('idle');
                } else {
                    // Default to generation
                    setIsGenerating(data.status === 'running');
                    setSynthesisStatus('idle');
                    setCompileStatus('idle');
                }
                
                if (data.status !== 'running') {
                    clearInterval(pollIntervalRef.current);
                    pollIntervalRef.current = null;
                    // Refresh history list after any job completes
                    syncScriptHistory();
                }
            } catch (err) {
                console.error('Polling error:', err);
            }
        }, 1500);
    };

    // Fetch config on load
    useEffect(() => {
        apiFetch('/api/config')
            .then(res => res.json())
            .then(data => {
                setServerStatus('Online');
                setApiKey(data.apiKey || FALLBACK_API_KEY);
                if (data.geminiApiKey) setGeminiApiKey(data.geminiApiKey);
                if (data.falApiKey) setFalApiKey(data.falApiKey);
                if (data.elevenlabsApiKey) setElevenlabsApiKey(data.elevenlabsApiKey);
                if (data.model) setModel(data.model);
                if (data.outputPath) setOutputPath(data.outputPath);
                if (data.characters) setCharacters(data.characters);
                if (data.visualDNA) setVisualDNA(data.visualDNA);
                if (data.styleReferences) setStyleReferences(data.styleReferences);
                
                // Fetch active background job status on load
                apiFetch('/api/generation-status')
                    .then(res => res.json())
                    .then(jobData => {
                        if (jobData.script) {
                            setCurrentScript(jobData.script);
                            if (jobData.script.historyFilename) setActiveHistoryFilename(jobData.script.historyFilename);
                        }
                        if (jobData.status === 'running') {
                            if (jobData.jobType === 'synthesis') {
                                setSynthesisStatus('running');
                            } else if (jobData.jobType === 'assembly') {
                                setCompileStatus('running');
                            } else {
                                setIsGenerating(true);
                            }
                            startPollingStatus();
                        }
                    })
                    .catch(e => console.error('Failed to load generation status:', e));

                // Load script history list
                syncScriptHistory();
            })
            .catch(err => {
                console.log('Client-only mode (offline)');
                setServerStatus('Offline (Client-Only)');
                
                try {
                    const backupStr = localStorage.getItem('doodleyt_history_backup');
                    if (backupStr) setScriptHistory(JSON.parse(backupStr));
                } catch(e) {}
                
                const cachedKey = localStorage.getItem('doodleyt_api_key') || FALLBACK_API_KEY;
                const cachedGeminiKey = localStorage.getItem('doodleyt_gemini_key') || '';
                const cachedFalKey = localStorage.getItem('doodleyt_fal_key') || '';
                const cachedElevenlabsKey = localStorage.getItem('doodleyt_elevenlabs_key') || '';
                const cachedModel = localStorage.getItem('doodleyt_model') || 'deepseek/deepseek-v4-flash';
                const cachedPath = localStorage.getItem('doodleyt_output_path') || 'E:/doodleyt/output';
                const cachedChars = localStorage.getItem('doodleyt_characters');
                const cachedVisualDNA = localStorage.getItem('doodleyt_visual_dna') || "Minimalist hand-drawn 2D vector-style cartoon illustration (similar to YouTube channel Zenn). Clean, smooth, non-jagged black felt-pen outlines and solid flat color fills. Exaggerated comical cartoon expressions (wide cartoon eyes, sweating, gaping mouth). Backgrounds are high-contrast and completely flat: solid white, bright solid yellow, deep solid black, or simple flat colored environments (no gradients, no realistic shading, no 3D rendering). Features bold, hand-drawn uppercase text overlays with thick black outlines (typically in bright yellow, red, or white) and clean, hand-drawn red pointing arrows or white speech bubbles where appropriate. Simple, clean, cute cartoon representations of characters, animals, and objects instead of complex or messy sketches. Perfect clean outlines (no messy or pixelated lines, no scribbled draft lines).";
                const cachedStyleReferences = localStorage.getItem('doodleyt_style_references') ? JSON.parse(localStorage.getItem('doodleyt_style_references')) : ['18154.jpg', '18153.jpg', '18152.jpg', '18142.jpg', '18146.jpg', '18143.jpg', '18147.jpg', '18151.jpg', '18149.jpg', '18159.jpg'];

                setApiKey(cachedKey);
                setGeminiApiKey(cachedGeminiKey);
                setFalApiKey(cachedFalKey);
                setElevenlabsApiKey(cachedElevenlabsKey);
                setModel(cachedModel);
                setOutputPath(cachedPath);
                setVisualDNA(cachedVisualDNA);
                setStyleReferences(cachedStyleReferences);

                try {
                    if (cachedChars) setCharacters(JSON.parse(cachedChars));
                } catch(e) {
                    setCharacters([{ name: 'HERO', description: 'Stick figure with round head, black outlines, green warrior tunic, brown leather belt, two dot eyes, and determined grin.' }]);
                }
            });

        return () => {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        };
    }, []);

    // Scroll logs to bottom
    useEffect(() => {
        if (logEndRef.current) {
            logEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [pipelineLogs]);

    const syncScriptHistory = async () => {
        try {
            const res = await apiFetch('/api/scripts-history');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const serverScripts = data.scripts || [];
            
            // Get local backup summaries
            let localBackup = [];
            try {
                const backupStr = localStorage.getItem('doodleyt_history_backup');
                if (backupStr) localBackup = JSON.parse(backupStr);
            } catch(e) {}
            
            // Get full scripts cache
            let fullCache = {};
            try {
                const cacheStr = localStorage.getItem('doodleyt_full_scripts_cache');
                if (cacheStr) fullCache = JSON.parse(cacheStr);
            } catch(e) {}

            if (serverScripts.length === 0 && localBackup.length > 0) {
                addLog('⚠️ Server history was empty (Render container was likely restarted). Auto-restoring backup history from browser...');
                let restoredCount = 0;
                for (const entry of localBackup) {
                    const fullScript = fullCache[entry.filename];
                    if (fullScript) {
                        try {
                            await apiFetch('/api/update-script-history', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ filename: entry.filename, script: fullScript })
                            });
                            restoredCount++;
                        } catch (err) {
                            console.error('Failed to restore script:', entry.filename, err);
                        }
                    }
                }
                if (restoredCount > 0) {
                    addLog(`✓ Successfully restored ${restoredCount} scripts from browser backup!`);
                    // Fetch history from server again now that it has been restored
                    const res2 = await apiFetch('/api/scripts-history');
                    if (res2.ok) {
                        const data2 = await res2.json();
                        const finalScripts = data2.scripts || [];
                        setScriptHistory(finalScripts);
                        localStorage.setItem('doodleyt_history_backup', JSON.stringify(finalScripts));
                    }
                }
            } else {
                setScriptHistory(serverScripts);
                if (serverScripts.length > 0) {
                    localStorage.setItem('doodleyt_history_backup', JSON.stringify(serverScripts));
                    
                    // Pre-cache full scripts in the background for any scripts we don't have cached yet
                    let updatedCache = false;
                    for (const entry of serverScripts) {
                        if (!fullCache[entry.filename]) {
                            try {
                                const loadRes = await apiFetch(`/api/load-script?filename=${encodeURIComponent(entry.filename)}`);
                                if (loadRes.ok) {
                                    const loadData = await loadRes.json();
                                    if (loadData.script) {
                                        fullCache[entry.filename] = loadData.script;
                                        updatedCache = true;
                                    }
                                }
                            } catch (e) {
                                console.error('Failed to pre-cache script:', entry.filename, e);
                            }
                        }
                    }
                    if (updatedCache) {
                        localStorage.setItem('doodleyt_full_scripts_cache', JSON.stringify(fullCache));
                    }
                }
            }
        } catch (err) {
            console.error('Failed to sync script history:', err);
            // Fallback to local storage backup if backend is entirely offline
            try {
                const backupStr = localStorage.getItem('doodleyt_history_backup');
                if (backupStr) {
                    setScriptHistory(JSON.parse(backupStr));
                }
            } catch(e) {}
        }
    };

    const saveConfig = async (updatedFields) => {
        if (updatedFields.apiKey !== undefined) localStorage.setItem('doodleyt_api_key', updatedFields.apiKey);
        if (updatedFields.geminiApiKey !== undefined) localStorage.setItem('doodleyt_gemini_key', updatedFields.geminiApiKey);
        if (updatedFields.falApiKey !== undefined) localStorage.setItem('doodleyt_fal_key', updatedFields.falApiKey);
        if (updatedFields.elevenlabsApiKey !== undefined) localStorage.setItem('doodleyt_elevenlabs_key', updatedFields.elevenlabsApiKey);
        if (updatedFields.model !== undefined) localStorage.setItem('doodleyt_model', updatedFields.model);
        if (updatedFields.outputPath !== undefined) localStorage.setItem('doodleyt_output_path', updatedFields.outputPath);
        if (updatedFields.characters !== undefined) localStorage.setItem('doodleyt_characters', JSON.stringify(updatedFields.characters));
        if (updatedFields.visualDNA !== undefined) localStorage.setItem('doodleyt_visual_dna', updatedFields.visualDNA);
        if (updatedFields.styleReferences !== undefined) localStorage.setItem('doodleyt_style_references', JSON.stringify(updatedFields.styleReferences));

        if (serverStatus.includes('Offline')) return;
        try {
            await apiFetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedFields)
            });
        } catch (e) {
            console.error('Failed to sync settings', e);
        }
    };

    const addLog = (msg) => {
        setPipelineLogs(prev => [...prev.slice(-499), `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    // Helper to format timestamps dynamically
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Brainstorms 10 viral ideas covering all core categories
    const generateTopicsViaAI = async () => {
        addLog('Inquiring local server to brainstorm 10 viral niche matrices...');
        setIsGenerating(true);
        try {
            const response = await apiFetch('/api/brainstorm-topics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey, model })
            });
            
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || `HTTP ${response.status}`);
            }
            
            const data = await response.json();
            if (data.topics && data.topics.length > 0) {
                setTopicBank(data.topics);
                setSelectedTopic(data.topics[0]);
                addLog('✓ Received 10 custom YouTube ideas based on our categories.');
            } else {
                throw new Error('Invalid brainstorm response structure');
            }
        } catch (e) {
            addLog(`❌ Error generating niches: ${e.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    // Orchestrates sequential, multi-call generation logic in background on the server
    const runScriptGeneration = async (topicTheme) => {
        if (currentScript && !window.confirm("You have an active script in the sandbox. Starting a new generation will clear it. Proceed?")) {
            return;
        }

        setIsGenerating(true);
        setPipelineLogs(['[System] Triggering script generation from backend orchestrator...']);
        
        // Reset dynamic stages to idle status
        setPipelineStages(prev => prev.map(s => ({ ...s, status: 'idle' })));
        
        try {
            const response = await apiFetch('/api/generate-script', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topicTheme,
                    videoType,
                    targetDuration,
                    apiKey,
                    model
                })
            });
            
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || `HTTP ${response.status}`);
            }
            
            // Clear script state only after confirmed success
            setCurrentScript(null);
            setActiveHistoryFilename(null);
            startPollingStatus();
        } catch (e) {
            addLog(`❌ Failed to start generation: ${e.message}`);
            setIsGenerating(false);
        }
    };

    const cancelScriptGeneration = async () => {
        try {
            await apiFetch('/api/cancel-generation', { method: 'POST' });
            setIsGenerating(false);
            setSynthesisStatus('idle');
            setCompileStatus('idle');
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
            addLog('🛑 Generation cancelled.');
        } catch (e) {
            console.error('Failed to cancel generation:', e);
        }
    };

    const runAssetSynthesis = async () => {
        if (!currentScript) return;
        setSynthesisStatus('running');
        setPipelineLogs(['[System] Triggering asset synthesis on the backend...']);
        addLog('⚡ Launching media asset synthesis pipeline (images & audio)...');
        addLog(`🔑 Using configuration: Gemini Image Gen (${geminiApiKey ? 'Provided' : 'Not Provided'}), Fal.ai (${falApiKey ? 'Provided' : 'Mock Fallback'}), Voice (${apiKey || elevenlabsApiKey ? 'OpenRouter/ElevenLabs' : 'Mock Fallback'})`);
        
        try {
            const response = await apiFetch('/api/synthesize-assets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    script: currentScript,
                    apiKey,
                    falApiKey,
                    elevenlabsApiKey,
                    geminiApiKey,
                    outputPath
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || `HTTP ${response.status}`);
            }

            startPollingStatus();
        } catch (e) {
            addLog(`❌ Synthesis pipeline failed: ${e.message}`);
            setSynthesisStatus('failed');
        }
    };

    const copyEntireScriptToClipboard = () => {
        if (!currentScript) return;
        const seoBlock = currentScript.seoMetadata ? `
=== SEO METADATA ===
DESCRIPTION:
${currentScript.seoMetadata.description}

HASHTAGS:
${Array.isArray(currentScript.seoMetadata.hashtags) ? currentScript.seoMetadata.hashtags.join(' ') : currentScript.seoMetadata.hashtags}

TAGS:
${currentScript.seoMetadata.tags}

THUMBNAIL PROMPT:
${currentScript.thumbnail}
===========================
` : '';
        const text = seoBlock + currentScript.scenes.map((s, idx) => {
            return `Scene ${idx + 1} (${s.time} | ${s.duration}s)\nVO: "${s.voiceover}"\nPrompt: ${s.prompt}\n----------------------------------------`;
        }).join('\n\n');
        copyToClipboard(text, 'full-script');
    };

    const runVideoCompilation = async () => {
        if (!currentScript) return;
        setCompileStatus('running');
        setPipelineLogs(['[System] Triggering video compilation on the backend...']);
        addLog('🎬 Launching FFmpeg compiler stitching routine...');
        
        try {
            const response = await apiFetch('/api/assemble-video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    script: currentScript,
                    outputPath
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || `HTTP ${response.status}`);
            }

            startPollingStatus();
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
            const updatedScenes = [...currentScript.scenes];
            
            for (const index of flaggedIndices) {
                const scene = updatedScenes[index];
                addLog(`Fixing Scene ${index + 1} (${scene.time})...`);
                
                const response = await apiFetch('/api/fix-prompt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt: scene.prompt,
                        characters: currentChars,
                        apiKey,
                        model
                    })
                });

                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error || `HTTP ${response.status}`);
                }

                const data = await response.json();
                scene.prompt = data.correctedText;
                
                const checkAgain = validatePromptText(scene.prompt);
                scene.qcErrors = checkAgain.words;
                if (checkAgain.isValid) {
                    addLog(`   Scene ${index + 1} fixed.`);
                } else {
                    addLog(`   Scene ${index + 1} still has issues: [${checkAgain.words.join(', ')}]`);
                }
            }
            
            setCurrentScript(prev => {
                if (!prev) return null;
                return { ...prev, scenes: updatedScenes };
            });
            
            addLog(`✓ Automated prompt sanitation complete.`);
        } catch (e) {
            addLog(`❌ Automated QC correction failed: ${e.message}`);
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
            const headers = ['Time', 'Duration', 'Voiceover Script', 'Stateless Visual Prompt'];
            const rows = currentScript.scenes.map(s => [
                s.time || '',
                s.duration || '',
                s.voiceover || '',
                s.prompt || ''
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
        } else if (format === 'html') {
            const escapeHtml = (unsafe) => {
                if (!unsafe) return '';
                return unsafe
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");
            };

            const scenesHtml = currentScript.scenes.map((scene, idx) => `
                <tr class="hover:bg-neutral-950/20 transition-colors">
                    <td class="py-5 px-4 font-mono font-extrabold text-neutral-450 text-center">
                        <div class="bg-neutral-950 border border-neutral-850 py-2 rounded-xl text-center">${escapeHtml(scene.time)}</div>
                    </td>
                    <td class="py-5 px-4 font-mono text-neutral-450 text-center">
                        <div class="bg-neutral-950 border border-neutral-850 py-2 rounded-xl text-center">${scene.duration}s</div>
                    </td>
                    <td class="py-5 px-5 vertical-align-top">
                        <div class="relative bg-neutral-950 border border-neutral-850 p-4 pb-12 rounded-2xl min-h-[120px] text-neutral-300 leading-relaxed text-sm">
                            ${escapeHtml(scene.voiceover)}
                            <button id="vo_copy_${idx}" onclick="copyToClipboard(decodeURIComponent('${encodeURIComponent(scene.voiceover || '')}'), 'vo_copy_${idx}')" class="absolute bottom-2.5 right-2.5 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-450 hover:text-white px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold transition-all">📋 Copy</button>
                        </div>
                    </td>
                    <td class="py-5 px-5 vertical-align-top">
                        <div class="relative bg-neutral-950 border border-neutral-850 p-4 pb-12 rounded-2xl min-h-[140px] text-neutral-350 font-mono text-xs leading-normal">
                            ${escapeHtml(scene.prompt)}
                            <button id="prompt_copy_${idx}" onclick="copyToClipboard(decodeURIComponent('${encodeURIComponent(scene.prompt || '')}'), 'prompt_copy_${idx}')" class="absolute bottom-2.5 right-2.5 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-455 hover:text-white px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold transition-all">📋 Copy</button>
                        </div>
                    </td>
                </tr>
            `).join('');

            const mobileCardsHtml = currentScript.scenes.map((scene, idx) => `
                <div class="bg-neutral-900 border border-neutral-800 p-5 rounded-3xl space-y-4">
                    <div class="flex justify-between items-center border-b border-neutral-800 pb-3">
                        <span class="font-extrabold text-sm text-neutral-300 font-mono">Scene #${idx + 1}</span>
                        <div class="flex items-center gap-3">
                            <span class="text-xs text-neutral-400 font-mono">Time: <strong class="text-neutral-225">${escapeHtml(scene.time)}</strong></span>
                            <span class="text-xs text-neutral-400 font-mono">Dur: <strong class="text-neutral-225">${scene.duration}s</strong></span>
                        </div>
                    </div>
                    
                    <div class="space-y-1">
                        <div class="flex justify-between items-center">
                            <label class="text-[10px] font-mono text-neutral-450 uppercase tracking-wider font-bold">Voiceover Script</label>
                            <button id="m_vo_copy_${idx}" onclick="copyToClipboard(decodeURIComponent('${encodeURIComponent(scene.voiceover || '')}'), 'm_vo_copy_${idx}')" class="bg-neutral-950 hover:bg-neutral-850 border border-neutral-800 text-neutral-450 px-2 py-0.5 rounded text-[9px] font-mono font-bold transition-all">📋 Copy</button>
                        </div>
                        <div class="bg-neutral-950 border border-neutral-850 p-3.5 rounded-2xl text-neutral-300 text-sm leading-relaxed">${escapeHtml(scene.voiceover)}</div>
                    </div>



                    <div class="space-y-1">
                        <div class="flex justify-between items-center">
                            <label class="text-[10px] font-mono text-neutral-455 uppercase tracking-wider font-bold">Stateless Visual Prompt</label>
                            <button id="m_prompt_copy_${idx}" onclick="copyToClipboard(decodeURIComponent('${encodeURIComponent(scene.prompt || '')}'), 'm_prompt_copy_${idx}')" class="bg-neutral-950 hover:bg-neutral-850 border border-neutral-800 text-neutral-455 px-2 py-0.5 rounded text-[9px] font-mono font-bold transition-all">📋 Copy</button>
                        </div>
                        <div class="bg-neutral-950 border border-neutral-850 p-3.5 rounded-2xl text-neutral-300 font-mono text-xs leading-normal">${escapeHtml(scene.prompt)}</div>
                    </div>
                </div>
            `).join('');

            const hashtagsText = Array.isArray(currentScript.seoMetadata?.hashtags)
                ? currentScript.seoMetadata.hashtags.join(' ')
                : currentScript.seoMetadata?.hashtags || 'N/A';

            const seoBlock = currentScript.seoMetadata ? `
            <div class="mt-6 pt-6 border-t border-neutral-800 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                    <h3 class="text-xs font-mono font-bold text-neutral-455 uppercase tracking-wider">SEO Description</h3>
                    <p class="text-xs text-neutral-400 mt-1 leading-relaxed">${escapeHtml(currentScript.seoMetadata.description || 'N/A')}</p>
                </div>
                <div>
                    <h3 class="text-xs font-mono font-bold text-neutral-455 uppercase tracking-wider">Hashtags</h3>
                    <p class="text-xs text-neutral-400 mt-1 leading-relaxed font-mono">${escapeHtml(hashtagsText)}</p>
                </div>
                <div>
                    <h3 class="text-xs font-mono font-bold text-neutral-455 uppercase tracking-wider">YouTube Tags</h3>
                    <p class="text-xs text-neutral-400 mt-1 leading-relaxed font-mono">${escapeHtml(currentScript.seoMetadata.tags || 'N/A')}</p>
                </div>
            </div>
            ` : '';

            content = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(currentScript.title)} - Script Blueprint</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['Inter', 'sans-serif'],
                        outfit: ['Outfit', 'sans-serif'],
                    }
                }
            }
        }
        function copyToClipboard(text, id) {
            navigator.clipboard.writeText(text).then(() => {
                const btn = document.getElementById(id);
                const originalText = btn.innerHTML;
                btn.innerHTML = '✓ Copied!';
                btn.classList.add('bg-green-950', 'border-green-500', 'text-green-400');
                btn.classList.remove('bg-neutral-900', 'border-neutral-800', 'text-neutral-455');
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.classList.remove('bg-green-950', 'border-green-500', 'text-green-400');
                    btn.classList.add('bg-neutral-900', 'border-neutral-800', 'text-neutral-455');
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
            });
        }
    </script>
    <style>
        body {
            background-color: #0a0a0a;
            color: #e5e5e5;
            font-family: 'Inter', sans-serif;
        }
    </style>
</head>
<body class="p-6 md:p-12 max-w-7xl mx-auto space-y-8">
    <!-- Header Block -->
    <div class="border border-neutral-800 bg-neutral-900/40 p-8 rounded-3xl backdrop-blur-md">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-neutral-800">
            <div>
                <span class="text-xs font-bold font-mono tracking-widest text-blue-500 uppercase">Doodle Theory Explainer Blueprint</span>
                <h1 class="text-3xl md:text-4xl font-extrabold font-outfit text-white mt-1">${escapeHtml(currentScript.title)}</h1>
            </div>
            <div class="flex gap-3">
                <span class="bg-neutral-800 border border-neutral-700/50 text-neutral-350 px-3 py-1.5 rounded-full text-xs font-mono font-bold capitalize">${escapeHtml(currentScript.videoType || 'widescreen')}</span>
                <span class="bg-blue-950/40 border border-blue-500/30 text-blue-400 px-3 py-1.5 rounded-full text-xs font-mono font-bold">${currentScript.targetDuration}s Target</span>
            </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div class="space-y-4">
                <div>
                    <h3 class="text-xs font-mono font-bold text-neutral-450 uppercase tracking-wider">Topic Category</h3>
                    <p class="text-sm font-semibold text-neutral-200 mt-1">${escapeHtml(currentScript.category || 'N/A')}</p>
                </div>
                <div>
                    <h3 class="text-xs font-mono font-bold text-neutral-450 uppercase tracking-wider">Hook & Pacing Angle</h3>
                    <p class="text-sm text-neutral-300 mt-1 leading-relaxed">${escapeHtml(currentScript.nicheReason || 'N/A')}</p>
                </div>
            </div>
            <div class="space-y-4">
                <div>
                    <h3 class="text-xs font-mono font-bold text-neutral-455 uppercase tracking-wider">Thumbnail Composition</h3>
                    <p class="text-sm text-neutral-300 mt-1 leading-relaxed font-mono bg-neutral-950/60 p-3 rounded-xl border border-neutral-850">${escapeHtml(currentScript.thumbnail || 'N/A')}</p>
                </div>
            </div>
        </div>
        ${seoBlock}
    </div>

    <!-- Sandbox View Replica -->
    <div class="space-y-4">
        <h2 class="text-xl font-bold font-outfit text-white flex items-center gap-2">
            <span class="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse"></span>
            Script Sandbox Blueprint
        </h2>
        
        <!-- Desktop Table -->
        <div class="hidden md:block bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl">
            <div class="overflow-x-auto">
                <table class="w-full min-w-[1200px] text-left border-collapse table-fixed">
                    <colgroup>
                        <col class="w-[80px]" />
                        <col class="w-[80px]" />
                        <col class="w-[380px]" />
                        <col class="w-[200px]" />
                        <col class="w-[660px]" />
                    </colgroup>
                    <thead>
                        <tr class="bg-neutral-950 border-b border-neutral-800 text-[11px] font-mono text-neutral-450 uppercase tracking-wider">
                            <th class="py-4 px-4 text-center">Time</th>
                            <th class="py-4 px-4 text-center">Dur</th>
                            <th class="py-4 px-5">Voiceover Script</th>
                            <th class="py-4 px-5">Stateless Visual Prompt</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-neutral-800 text-sm">
                        ${scenesHtml}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Mobile Card View -->
        <div class="block md:hidden space-y-4">
            ${mobileCardsHtml}
        </div>
    </div>
</body>
</html>`;
        }

        addLog(`💾 Attempting to save script as ${format.toUpperCase()}...`);

        try {
            let mimeType = 'text/plain';
            if (format === 'json') mimeType = 'application/json';
            else if (format === 'csv') mimeType = 'text/csv;charset=utf-8;';
            else if (format === 'html') mimeType = 'text/html;charset=utf-8;';
            const blob = new Blob([content], { type: mimeType });
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
                const response = await apiFetch('/api/save', {
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

    // Load a script from history (without overwriting another generation)
    const loadScriptFromHistory = async (filename) => {
        setHistoryLoading(true);
        try {
            const res = await apiFetch(`/api/load-script?filename=${encodeURIComponent(filename)}`);
            if (!res.ok) throw new Error('Failed to load script');
            const data = await res.json();
            setCurrentScript(data.script);
            setActiveHistoryFilename(filename);
            setShowHistoryPanel(false);
            setActiveTab('sandbox');
            addLog(`📂 Loaded history script: "${data.script.title}"`);

            // Cache full script in local storage
            try {
                const cacheStr = localStorage.getItem('doodleyt_full_scripts_cache') || '{}';
                const cache = JSON.parse(cacheStr);
                cache[filename] = data.script;
                localStorage.setItem('doodleyt_full_scripts_cache', JSON.stringify(cache));
            } catch(e) {}
        } catch (e) {
            addLog(`❌ Failed to load history: ${e.message}`);
        } finally {
            setHistoryLoading(false);
        }
    };

    const deleteHistoryScript = async (filename, e) => {
        e.stopPropagation();
        if (!window.confirm('Delete this script from history? This cannot be undone.')) return;
        try {
            await apiFetch('/api/delete-script', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename })
            });
            setScriptHistory(prev => prev.filter(s => s.filename !== filename));
            if (activeHistoryFilename === filename) {
                setActiveHistoryFilename(null);
            }

            // Remove from local storage backups as well
            try {
                const backupStr = localStorage.getItem('doodleyt_history_backup') || '[]';
                const backup = JSON.parse(backupStr).filter(s => s.filename !== filename);
                localStorage.setItem('doodleyt_history_backup', JSON.stringify(backup));

                const cacheStr = localStorage.getItem('doodleyt_full_scripts_cache') || '{}';
                const cache = JSON.parse(cacheStr);
                delete cache[filename];
                localStorage.setItem('doodleyt_full_scripts_cache', JSON.stringify(cache));
            } catch(e) {}
        } catch (e) {
            addLog(`❌ Delete failed: ${e.message}`);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-neutral-950 text-neutral-200">
            {/* TOP NAVBAR */}
            <nav className="border-b border-neutral-900 bg-neutral-900/40 backdrop-blur-md px-4 md:px-8 py-4 flex justify-between items-center sticky top-0 z-40">
                <div className="flex items-center gap-3">
                    {/* Hamburger Button for Mobile Drawer Toggling */}
                    <button 
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-2 -ml-2 text-neutral-450 hover:text-white md:hidden rounded-xl focus:outline-none hover:bg-neutral-900 transition-colors"
                        aria-label="Toggle Navigation Menu"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            {sidebarOpen ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                            )}
                        </svg>
                    </button>
                    <span className="bg-blue-600 text-white font-mono text-[10px] px-2 py-0.5 rounded font-bold tracking-wider hidden sm:inline-block">v2026</span>
                    <h1 className="text-sm md:text-lg font-black tracking-tight uppercase text-white flex items-center gap-2">
                        Doodle Theory <span className="text-blue-500">Explainer OS</span>
                    </h1>
                </div>
                <div className="flex items-center gap-3 md:gap-4">
                    {currentScript?.videoPath && (
                        <div className="flex items-center gap-2 mr-2">
                            <a 
                                href={getAssetUrl(currentScript.videoPath)} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-450 border border-emerald-900/30 text-xs font-semibold py-1.5 px-3 rounded-xl transition flex items-center gap-1.5"
                            >
                                📺 Watch Active Video
                            </a>
                            <button 
                                onClick={async () => {
                                    try {
                                        const res = await fetch(getAssetUrl(currentScript.videoPath));
                                        const blob = await res.blob();
                                        const blobUrl = URL.createObjectURL(blob);
                                        const link = document.createElement('a');
                                        link.href = blobUrl;
                                        link.download = `video_${currentScript.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.mp4`;
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                    } catch (err) {
                                        window.open(getAssetUrl(currentScript.videoPath), '_blank');
                                    }
                                }}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 px-3 rounded-xl text-xs transition flex items-center gap-1.5 active:scale-98"
                            >
                                ⬇️ Download
                            </button>
                        </div>
                    )}
                    <div className="flex items-center gap-2 text-xs">
                        <span className={`w-2.5 h-2.5 rounded-full ${serverStatus.includes('Online') ? 'bg-green-500' : 'bg-amber-500'}`}></span>
                        <span className="text-neutral-400 font-mono hidden sm:inline-block">Server: {serverStatus}</span>
                    </div>
                    <div className="text-xs font-mono text-neutral-500">
                        {apiKey ? '🔐 API Configured' : '🔓 API Key Required'}
                    </div>
                </div>
            </nav>

            {/* SCRIPT HISTORY PANEL OVERLAY */}
            {showHistoryPanel && (
                <div className="fixed inset-0 z-50 flex">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowHistoryPanel(false)} />
                    <div className="relative ml-auto w-full max-w-md bg-neutral-950 border-l border-neutral-800 h-full flex flex-col shadow-2xl z-50">
                        <div className="flex items-center justify-between p-5 border-b border-neutral-800">
                            <div>
                                <h2 className="text-base font-black text-white">🗂️ Script History</h2>
                                <p className="text-[10px] text-neutral-500 font-mono mt-0.5">All generated scripts — saved permanently on server</p>
                            </div>
                            <button onClick={() => setShowHistoryPanel(false)} className="text-neutral-500 hover:text-white p-2 rounded-xl hover:bg-neutral-900 transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {historyLoading ? (
                                <div className="flex items-center justify-center py-12 text-neutral-500">
                                    <span className="w-5 h-5 border-2 border-neutral-600 border-t-blue-400 rounded-full animate-spin mr-2"></span> Loading...
                                </div>
                            ) : scriptHistory.length === 0 ? (
                                <div className="text-center py-12 text-neutral-600">
                                    <span className="text-4xl block mb-3">📄</span>
                                    <p className="text-sm">No scripts saved yet. Generate your first one!</p>
                                </div>
                            ) : (
                                scriptHistory.map((entry) => {
                                    const isActive = entry.filename === activeHistoryFilename;
                                    const date = entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'Unknown date';
                                    return (
                                        <div
                                            key={entry.filename}
                                            onClick={() => loadScriptFromHistory(entry.filename)}
                                            className={`p-4 rounded-2xl border cursor-pointer transition-all group relative ${
                                                isActive ? 'bg-blue-600/10 border-blue-500/30' : 'bg-neutral-900 border-neutral-800 hover:border-neutral-600'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex-1 pr-8">
                                                    <div className="text-sm font-bold text-white leading-snug line-clamp-2">{entry.title}</div>
                                                    <div className="text-[10px] text-neutral-500 font-mono mt-0.5">{entry.category}</div>
                                                </div>
                                                {isActive && <span className="absolute top-3 right-8 bg-blue-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded uppercase">Active</span>}
                                                <button
                                                    onClick={(e) => deleteHistoryScript(entry.filename, e)}
                                                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-400 transition-all p-1 rounded"
                                                    title="Delete from history"
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                            <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500">
                                                <span>⚡ {entry.sceneCount} scenes</span>
                                                <span className="uppercase text-[9px] bg-neutral-800 px-1.5 py-0.5 rounded">{entry.videoType || 'long'}</span>
                                            </div>
                                            <div className="text-[9px] text-neutral-600 font-mono mt-1">{date}</div>
                                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                                {entry.seoMetadata && <span className="text-[8px] bg-green-950/40 text-green-400 border border-green-900/30 px-1.5 py-0.5 rounded font-bold">SEO ✓</span>}
                                                {entry.videoPath ? (
                                                    <span className="text-[8px] bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 px-1.5 py-0.5 rounded font-bold">Video ✓</span>
                                                ) : entry.assetsSynthesized ? (
                                                    <span className="text-[8px] bg-blue-950/40 text-blue-400 border border-blue-900/30 px-1.5 py-0.5 rounded font-bold">Assets ✓</span>
                                                ) : (
                                                    <span className="text-[8px] bg-neutral-850 text-neutral-400 border border-neutral-800 px-1.5 py-0.5 rounded font-bold">Draft</span>
                                                )}
                                            </div>
                                            {entry.videoPath && (
                                                <div className="flex items-center gap-2 mt-3 pt-2 border-t border-neutral-800/40">
                                                    <a 
                                                        href={getAssetUrl(entry.videoPath)} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer" 
                                                        className="flex-1 bg-neutral-850 hover:bg-neutral-800 text-neutral-300 font-mono text-[9px] py-1 px-2 rounded-lg border border-neutral-750 hover:border-neutral-700 text-center transition-all flex items-center justify-center gap-1"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <span>📺</span> Watch
                                                    </a>
                                                    <button 
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            try {
                                                                const res = await fetch(getAssetUrl(entry.videoPath));
                                                                const blob = await res.blob();
                                                                const blobUrl = URL.createObjectURL(blob);
                                                                const link = document.createElement('a');
                                                                link.href = blobUrl;
                                                                link.download = `video_${entry.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.mp4`;
                                                                document.body.appendChild(link);
                                                                link.click();
                                                                document.body.removeChild(link);
                                                            } catch (err) {
                                                                window.open(getAssetUrl(entry.videoPath), '_blank');
                                                            }
                                                        }}
                                                        className="flex-1 bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-900/30 hover:border-emerald-750 font-mono text-[9px] py-1 px-2 rounded-lg text-center transition-all flex items-center justify-center gap-1"
                                                    >
                                                        <span>⬇️</span> Download
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-1 overflow-hidden relative">
                {/* Mobile sidebar overlay backdrop */}
                {sidebarOpen && (
                    <div 
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* SIDEBAR PANEL */}
                <aside className={`fixed inset-y-0 left-0 w-64 bg-neutral-950 border-r border-neutral-900 p-4 space-y-1.5 z-40 flex flex-col justify-between transform transition-transform duration-300 md:relative md:transform-none md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <div className="space-y-1.5">
                        <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest px-3 mb-3">Core Engines</div>
                        
                        <button onClick={() => { setActiveTab('terminal'); setSidebarOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all ${activeTab === 'terminal' ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white border border-transparent'}`}>
                            <span>💻</span> Execution Terminal
                        </button>
                        <button onClick={() => { setActiveTab('topics'); setSidebarOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all ${activeTab === 'topics' ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white border border-transparent'}`}>
                            <span>🧠</span> Niche Brainstormer
                        </button>
                        <button onClick={() => { setActiveTab('sandbox'); setSidebarOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all ${activeTab === 'sandbox' ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white border border-transparent'}`}>
                            <span>📝</span> Script Sandbox
                        </button>
                        <button onClick={() => { setActiveTab('videos'); setSidebarOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all ${activeTab === 'videos' ? 'bg-blue-600/10 text-blue-405 border border-blue-500/20' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white border border-transparent'}`}>
                            <span>🎥</span> Generated Videos
                            {scriptHistory.filter(s => s.videoPath).length > 0 && (
                                <span className="ml-auto bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                    {scriptHistory.filter(s => s.videoPath).length}
                                </span>
                            )}
                        </button>
                        <button onClick={() => { setActiveTab('characters'); setSidebarOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all ${activeTab === 'characters' ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white border border-transparent'}`}>
                            <span>👥</span> Custom Character DNA
                        </button>
                        <button onClick={() => { setActiveTab('settings'); setSidebarOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all ${activeTab === 'settings' ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white border border-transparent'}`}>
                            <span>⚙️</span> Settings & Models
                        </button>
                        <button onClick={() => { setActiveTab('visual'); setSidebarOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all ${activeTab === 'visual' ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white border border-transparent'}`}>
                            <span>🎨</span> Visual DNA Registry
                        </button>
                        <button onClick={() => { setActiveTab('qc'); setSidebarOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all ${activeTab === 'qc' ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white border border-transparent'}`}>
                            <span>🛡️</span> QC & Stateless Guardrails
                        </button>
                        <button onClick={() => { setShowHistoryPanel(true); setSidebarOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all text-neutral-400 hover:bg-neutral-900 hover:text-white border border-transparent relative`}>
                            <span>🗂️</span> Script History
                            {scriptHistory.length > 0 && (
                                <span className="ml-auto bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{scriptHistory.length}</span>
                            )}
                        </button>
                    </div>
                    <div className="bg-neutral-900/60 p-3 rounded-2xl border border-neutral-800 text-[10px] text-neutral-500 leading-relaxed font-mono">
                        🔒 Secured Pipeline Vault<br/>
                        Mode: Multistage Auto-Run<br/>
                        Script Target: {videoType === 'short' ? 'Dynamic (~15-25)' : `Dynamic (~${targetDuration * 15}-${targetDuration * 30})`} Scenes
                    </div>
                </aside>

                {/* WORKSPACE APP CONTENT */}
                <main className="flex-1 overflow-y-auto p-8">
                    
                    {/* EXECUTION TERMINAL TAB */}
                    {activeTab === 'terminal' && (
                        <TerminalView
                            customNicheInput={customNicheInput}
                            setCustomNicheInput={setCustomNicheInput}
                            selectedTopic={selectedTopic}
                            videoType={videoType}
                            setVideoType={setVideoType}
                            targetDuration={targetDuration}
                            setTargetDuration={setTargetDuration}
                            pipelineStages={pipelineStages}
                            isGenerating={isGenerating}
                            runScriptGeneration={runScriptGeneration}
                            cancelScriptGeneration={cancelScriptGeneration}
                            pipelineLogs={pipelineLogs}
                            logEndRef={logEndRef}
                            currentScript={currentScript}
                            copyEntireScriptToClipboard={copyEntireScriptToClipboard}
                            setActiveTab={setActiveTab}
                            synthesisStatus={synthesisStatus}
                            compileStatus={compileStatus}
                            runAssetSynthesis={runAssetSynthesis}
                            runVideoCompilation={runVideoCompilation}
                            copiedField={copiedField}
                            copyToClipboard={copyToClipboard}
                            getAssetUrl={getAssetUrl}
                        />
                    )}

                    {/* TOPIC BRAINSTORMER TAB */}
                    {activeTab === 'topics' && (
                        <TopicsView
                            topicBank={topicBank}
                            selectedTopic={selectedTopic}
                            setSelectedTopic={setSelectedTopic}
                            setCustomNicheInput={setCustomNicheInput}
                            addLog={addLog}
                            setActiveTab={setActiveTab}
                            isGenerating={isGenerating}
                            generateTopicsViaAI={generateTopicsViaAI}
                        />
                    )}

                    {/* SCRIPT SANDBOX TAB */}
                    {activeTab === 'sandbox' && (
                        <SandboxView
                            currentScript={currentScript}
                            setCurrentScript={setCurrentScript}
                            isGenerating={isGenerating}
                            copyEntireScriptToClipboard={copyEntireScriptToClipboard}
                            autoFixFlaggedPromptsLocally={autoFixFlaggedPromptsLocally}
                            saveScriptToDisk={saveScriptToDisk}
                            copiedField={copiedField}
                            copyToClipboard={copyToClipboard}
                            getAssetUrl={getAssetUrl}
                            handleCellEdit={handleCellEdit}
                            synthesisStatus={synthesisStatus}
                            compileStatus={compileStatus}
                            runAssetSynthesis={runAssetSynthesis}
                            runVideoCompilation={runVideoCompilation}
                        />
                    )}

                    {/* COMPILED VIDEOS HUB */}
                    {activeTab === 'videos' && (
                        <VideosView
                            scriptHistory={scriptHistory}
                            getAssetUrl={getAssetUrl}
                            copiedField={copiedField}
                            copyToClipboard={copyToClipboard}
                        />
                    )}

                    {/* CHARACTER REGISTRY TAB */}
                    {activeTab === 'characters' && (
                        <CharactersView
                            characters={characters}
                            setCharacters={setCharacters}
                            saveConfig={saveConfig}
                        />
                    )}

                    {/* SETTINGS TAB */}
                    {activeTab === 'settings' && (
                        <SettingsView
                            apiKey={apiKey}
                            setApiKey={setApiKey}
                            geminiApiKey={geminiApiKey}
                            setGeminiApiKey={setGeminiApiKey}
                            falApiKey={falApiKey}
                            setFalApiKey={setFalApiKey}
                            elevenlabsApiKey={elevenlabsApiKey}
                            setElevenlabsApiKey={setElevenlabsApiKey}
                            model={model}
                            setModel={setModel}
                            outputPath={outputPath}
                            setOutputPath={setOutputPath}
                            visualDNA={visualDNA}
                            setVisualDNA={setVisualDNA}
                            styleReferences={styleReferences}
                            setStyleReferences={setStyleReferences}
                            characters={characters}
                            saveConfig={saveConfig}
                        />
                    )}

                    {/* VISUAL DNA TAB */}
                    {activeTab === 'visual' && (
                        <VisualDNAView
                            visualDNA={visualDNA}
                            setVisualDNA={setVisualDNA}
                            styleReferences={styleReferences}
                            saveConfig={saveConfig}
                        />
                    )}

                    {/* STATELESS QC GUARDRAILS TAB */}
                    {activeTab === 'qc' && (
                        <QCView
                            BANNED_PRONOUNS={BANNED_PRONOUNS}
                            validatePromptText={validatePromptText}
                        />
                    )}
                </main>
            </div>


        </div>
    );
}

export default App;
