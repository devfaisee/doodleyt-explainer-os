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
    visualDNA: "Crude whiteboard cartoon illustration style (similar to channel Zenn). Hand-drawn felt-pen black outlines, flat solid color fills, highly exaggerated comical expressions (wide eyes, sweating, gaping mouths). Backgrounds are simple and high-contrast: solid white, bright solid yellow, deep solid black, or flat colored environments (like soft blue ice, dark navy cave, or ocean floor). Features bold, hand-drawn uppercase text overlays with thick black outlines (typically in bright yellow, red, or white) and simple hand-drawn red pointing arrows or white speech bubbles where appropriate. Simple, cute cartoon representations of animals, people, and objects instead of complex artwork. No gradients, no 3D elements, no realistic shading.",
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
    const [falApiKey, setFalApiKey] = useState('');
    const [elevenlabsApiKey, setElevenlabsApiKey] = useState('');
    const [model, setModel] = useState('deepseek/deepseek-v4-flash');
    const [outputPath, setOutputPath] = useState('');
    const API_SERVER_URL = 'https://doodleyt-explainer-os.render.com';

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
    const [targetDuration, setTargetDuration] = useState(8); // target in minutes (2, 5, 8, 10, 12)
    
    const [visualDNA, setVisualDNA] = useState("Crude whiteboard cartoon illustration style (similar to channel Zenn). Hand-drawn felt-pen black outlines, flat solid color fills, highly exaggerated comical expressions (wide eyes, sweating, gaping mouths). Backgrounds are simple and high-contrast: solid white, bright solid yellow, deep solid black, or flat colored environments (like soft blue ice, dark navy cave, or ocean floor). Features bold, hand-drawn uppercase text overlays with thick black outlines (typically in bright yellow, red, or white) and simple hand-drawn red pointing arrows or white speech bubbles where appropriate. Simple, cute cartoon representations of animals, people, and objects instead of complex artwork. No gradients, no 3D elements, no realistic shading.");
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
                const cachedFalKey = localStorage.getItem('doodleyt_fal_key') || '';
                const cachedElevenlabsKey = localStorage.getItem('doodleyt_elevenlabs_key') || '';
                const cachedModel = localStorage.getItem('doodleyt_model') || 'deepseek/deepseek-v4-flash';
                const cachedPath = localStorage.getItem('doodleyt_output_path') || 'E:/doodleyt/output';
                const cachedChars = localStorage.getItem('doodleyt_characters');
                const cachedVisualDNA = localStorage.getItem('doodleyt_visual_dna') || "Crude whiteboard cartoon illustration style (similar to channel Zenn). Hand-drawn felt-pen black outlines, flat solid color fills, highly exaggerated comical expressions (wide eyes, sweating, gaping mouths). Backgrounds are simple and high-contrast: solid white, bright solid yellow, deep solid black, or flat colored environments (like soft blue ice, dark navy cave, or ocean floor). Features bold, hand-drawn uppercase text overlays with thick black outlines (typically in bright yellow, red, or white) and simple hand-drawn red pointing arrows or white speech bubbles where appropriate. Simple, cute cartoon representations of animals, people, and objects instead of complex artwork. No gradients, no 3D elements, no realistic shading.";
                const cachedStyleReferences = localStorage.getItem('doodleyt_style_references') ? JSON.parse(localStorage.getItem('doodleyt_style_references')) : ['18154.jpg', '18153.jpg', '18152.jpg', '18142.jpg', '18146.jpg', '18143.jpg', '18147.jpg', '18151.jpg', '18149.jpg', '18159.jpg'];

                setApiKey(cachedKey);
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
        addLog(`🔑 Using configuration: Fal.ai (${falApiKey ? 'Provided' : 'Mock Fallback'}), ElevenLabs (${elevenlabsApiKey ? 'Provided' : 'Mock Fallback'})`);
        
        try {
            const response = await apiFetch('/api/synthesize-assets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    script: currentScript,
                    falApiKey,
                    elevenlabsApiKey,
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
            return `Scene ${idx + 1} (${s.time} | ${s.duration}s)\nVO: "${s.voiceover}"\nSFX: ${s.sfx} | Camera: ${s.camera}\nPrompt: ${s.prompt}\nOverlay: ${s.textOverlay || 'None'}\n----------------------------------------`;
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
                        <div className="space-y-6 max-w-5xl">
                            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl shadow-lg space-y-4">
                                <div>
                                    <h2 className="text-xl font-bold text-white mb-1">Autonomous Multistage Terminal</h2>
                                    <p className="text-sm text-neutral-400 font-medium">Clicking <strong>Launch Production Blueprint</strong> starts an automated background orchestrator. It executes sequential LLM calls to write a complete, dynamically-paced script in acts without lazy truncations or identical copy-pasted prompts.</p>
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
                                                <option value={2}>2 Minutes (Dynamic Scene Count)</option>
                                                <option value={5}>5 Minutes (Dynamic Scene Count)</option>
                                                <option value={8}>8 Minutes (Dynamic Scene Count)</option>
                                                <option value={10}>10 Minutes (Dynamic Scene Count)</option>
                                                <option value={12}>12 Minutes (Dynamic Scene Count)</option>
                                            </select>
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center pt-2">
                                    {/* PIPELINE STAGES CHECKLIST */}
                                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-mono max-w-xl">
                                        {pipelineStages.map(s => (
                                            <div key={s.id} className="flex items-center gap-1.5">
                                                <span className={`w-2.5 h-2.5 rounded-full ${s.status === 'completed' ? 'bg-green-500' : s.status === 'running' ? 'bg-blue-500 animate-pulse' : s.status === 'failed' ? 'bg-red-500' : 'bg-neutral-700'}`}></span>
                                                <span className={`${s.status === 'running' ? 'text-blue-400 font-bold' : s.status === 'completed' ? 'text-neutral-350' : 'text-neutral-500'}`}>{s.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                    {/* Show error if pipeline failed */}
                                    {pipelineStages.some(s => s.status === 'failed') && (
                                        <div className="bg-red-950/20 border border-red-500/30 p-3 rounded-xl text-red-400 text-xs font-mono">
                                            ❌ Pipeline failed. Check logs above for details.
                                        </div>
                                    )}
                                    
                                    <div className="flex gap-2 w-full md:w-auto shrink-0">
                                        <button 
                                            onClick={() => runScriptGeneration(customNicheInput)}
                                            disabled={isGenerating}
                                            className="bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-bold px-7 py-4 rounded-2xl transition-all shadow-lg shadow-blue-600/15 flex items-center justify-center gap-2 glow-active w-full md:w-auto"
                                        >
                                            {isGenerating ? (
                                                <>
                                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                                    Generating...
                                                </>
                                            ) : (
                                                '🚀 Launch Production Blueprint'
                                            )}
                                        </button>
                                        {isGenerating && (
                                            <button 
                                                onClick={cancelScriptGeneration}
                                                className="bg-red-700 hover:bg-red-650 text-white font-bold px-5 py-4 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 w-full md:w-auto"
                                            >
                                                🛑 Stop
                                            </button>
                                        )}
                                    </div>
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
                                            <div className="flex items-center gap-3">
                                                <button 
                                                    onClick={copyEntireScriptToClipboard}
                                                    className="text-xs text-neutral-450 hover:text-white font-semibold flex items-center gap-1 transition-colors"
                                                >
                                                    📋 Copy Script
                                                </button>
                                                <button 
                                                    onClick={() => setActiveTab('sandbox')}
                                                    className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors"
                                                >
                                                    Open Full Screen View ➔
                                                </button>
                                            </div>
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
                                                    {currentScript.scenes.slice(0, 4).map((scene, i) => {
                                                         const indexStr = (i + 1).toString().padStart(3, '0');
                                                         return (
                                                             <div key={i} className="bg-neutral-950 border border-neutral-800 p-4 rounded-2xl flex flex-col sm:flex-row gap-4 animate-fadeIn">
                                                                 <div className="flex-1 space-y-2">
                                                                     <div className="flex justify-between items-center text-xs">
                                                                         <span className="bg-neutral-850 text-neutral-300 px-2 py-0.5 rounded font-mono font-bold">{scene.time} ({scene.duration}s)</span>
                                                                         <span className="text-purple-400 font-mono font-medium">SFX: {scene.sfx}</span>
                                                                     </div>
                                                                     <p className="text-sm text-neutral-200">"{scene.voiceover}"</p>
                                                                     <div className="text-[10px] font-mono text-neutral-500 leading-relaxed bg-neutral-900/60 p-2.5 rounded-xl border border-neutral-800 relative">
                                                                         <div className="flex justify-between items-center mb-1">
                                                                             <span className="text-neutral-450 block font-bold">Image Prompt:</span>
                                                                             <button 
                                                                                 onClick={() => {
                                                                                     navigator.clipboard.writeText(scene.prompt);
                                                                                     alert('Prompt copied!');
                                                                                 }}
                                                                                 className="text-[10px] font-bold text-neutral-400 hover:text-white bg-neutral-950 px-2 py-0.5 rounded border border-neutral-850 transition-colors"
                                                                             >
                                                                                 📋 Copy
                                                                             </button>
                                                                         </div>
                                                                         <span className="text-neutral-350 block select-all">{scene.prompt}</span>
                                                                     </div>
                                                                 </div>
                                                             </div>
                                                         );
                                                     })}
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
                            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between shadow-lg">
                                <div>
                                    <h2 className="text-xl font-bold text-white mb-1">Production Script Sandbox</h2>
                                    <p className="text-sm text-neutral-400">Directly edit generated scripts in real time, audit stateless prompts, and save clean outputs.</p>
                                </div>
                                {currentScript && (
                                    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                                        <button 
                                            onClick={copyEntireScriptToClipboard}
                                            className="bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 text-neutral-200 hover:text-white font-bold px-4 py-2.5 rounded-xl text-xs transition flex items-center gap-1.5"
                                        >
                                            📋 Copy Full Script
                                        </button>
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
                                            className="bg-neutral-850 hover:bg-neutral-800 border border-neutral-750 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition"
                                        >
                                            Export CSV
                                        </button>
                                    </div>
                                )}
                            </div>

                            {currentScript ? (
                                <div className="space-y-6">

                                    {/* SCRIPT META: Title + Thumbnail + SEO */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {/* Compiled Video Player */}
                                        {currentScript.videoPath && (
                                            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl space-y-4 shadow-xl col-span-1 lg:col-span-2">
                                                <h3 className="text-xs font-bold uppercase tracking-widest font-mono text-blue-400 flex items-center gap-2">
                                                    <span>🎬</span> Generated Video Output
                                                </h3>
                                                <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black border border-neutral-800 relative">
                                                    <video 
                                                        src={getAssetUrl(currentScript.videoPath)} 
                                                        controls 
                                                        className="w-full h-full object-contain"
                                                    />
                                                </div>
                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2">
                                                    <span className="text-[10px] text-neutral-500 font-mono select-all">
                                                        Web URL: {getAssetUrl(currentScript.videoPath)}
                                                    </span>
                                                    <a 
                                                        href={getAssetUrl(currentScript.videoPath)} 
                                                        download={`video_${currentScript.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.mp4`}
                                                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition flex items-center gap-1.5 w-full sm:w-auto justify-center"
                                                    >
                                                        📥 Download Video
                                                    </a>
                                                </div>
                                            </div>
                                        )}

                                        {/* Thumbnail Prompt */}
                                        {currentScript.thumbnail && (
                                            <div className="bg-gradient-to-br from-amber-950/20 to-neutral-900 border border-amber-500/20 p-5 rounded-3xl space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-xs font-bold uppercase tracking-widest font-mono text-amber-400">🖼️ AI Thumbnail Prompt</h3>
                                                    <div className="flex gap-2">
                                                        {currentScript.thumbnailPath && (
                                                            <a
                                                                href={getAssetUrl(currentScript.thumbnailPath)}
                                                                download={`thumbnail_${currentScript.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.png`}
                                                                className="text-[10px] font-bold px-2.5 py-1 rounded-lg border bg-amber-900/30 border-amber-800/30 text-amber-400 hover:text-white transition-all font-mono"
                                                            >
                                                                📥 Download Image
                                                            </a>
                                                        )}
                                                        <button
                                                            onClick={() => copyToClipboard(currentScript.thumbnail, 'thumbnail')}
                                                            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all font-mono flex items-center gap-1 ${copiedField === 'thumbnail' ? 'bg-green-950/40 border-green-500/30 text-green-400' : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-600'}`}
                                                        >
                                                            {copiedField === 'thumbnail' ? '✓ Copied!' : '📋 Copy Prompt'}
                                                        </button>
                                                    </div>
                                                </div>
                                                
                                                {currentScript.thumbnailPath && (
                                                    <div className="aspect-video w-full rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-850 mb-3 flex items-center justify-center">
                                                        <img 
                                                            src={getAssetUrl(currentScript.thumbnailPath)} 
                                                            alt="AI Generated Thumbnail" 
                                                            className="max-h-full max-w-full object-contain"
                                                        />
                                                    </div>
                                                )}
                                                <textarea
                                                    rows="4"
                                                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-amber-500 p-3 rounded-2xl text-xs text-amber-200/80 font-mono leading-relaxed outline-none resize-none"
                                                    value={currentScript.thumbnail}
                                                    onChange={(e) => {
                                                        const newVal = e.target.value;
                                                        setCurrentScript(prev => ({ ...prev, thumbnail: newVal }));
                                                    }}
                                                />
                                            </div>
                                        )}

                                        {/* Script Info */}
                                        <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-3xl space-y-3">
                                            <h3 className="text-xs font-bold uppercase tracking-widest font-mono text-neutral-400">📊 Script Info</h3>
                                            <div className="space-y-3.5">
                                                <div>
                                                    <label className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider block mb-1">Title</label>
                                                    <input
                                                        type="text"
                                                        className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-2.5 rounded-xl text-sm font-extrabold text-white outline-none"
                                                        value={currentScript.title}
                                                        onChange={(e) => {
                                                            const newVal = e.target.value;
                                                            setCurrentScript(prev => ({ ...prev, title: newVal }));
                                                        }}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider block mb-1">Category</label>
                                                    <input
                                                        type="text"
                                                        className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-2.5 rounded-xl text-xs text-blue-400 font-mono font-bold outline-none"
                                                        value={currentScript.category || ''}
                                                        onChange={(e) => {
                                                            const newVal = e.target.value;
                                                            setCurrentScript(prev => ({ ...prev, category: newVal }));
                                                        }}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider block mb-1">Niche Viability</label>
                                                    <textarea
                                                        rows="2"
                                                        className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-2.5 rounded-xl text-[10px] text-neutral-400 font-mono leading-relaxed outline-none resize-none"
                                                        value={currentScript.nicheReason || ''}
                                                        onChange={(e) => {
                                                            const newVal = e.target.value;
                                                            setCurrentScript(prev => ({ ...prev, nicheReason: newVal }));
                                                        }}
                                                    />
                                                </div>
                                                <div className="flex gap-3 text-[10px] font-mono text-neutral-500 pt-1">
                                                    <span>⚡ {currentScript.scenes?.length || 0} scenes</span>
                                                    <span className="uppercase bg-neutral-850 px-1.5 py-0.5 rounded text-neutral-350">{currentScript.videoType || 'long'}</span>
                                                    {currentScript.historyFilename && <span className="text-green-400 font-bold">💾 Auto-Saved</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* SEO METADATA PANEL */}
                                    {currentScript.seoMetadata && (
                                        <div className="bg-gradient-to-br from-emerald-950/20 to-neutral-900 border border-emerald-500/20 p-5 rounded-3xl space-y-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="text-xs font-bold uppercase tracking-widest font-mono text-emerald-400">🌐 YouTube SEO Package</h3>
                                                <span className="text-[9px] bg-emerald-950/40 text-emerald-300 border border-emerald-800/40 px-2 py-0.5 rounded-full font-bold font-mono">Ready to Copy-Paste</span>
                                            </div>

                                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                                {/* Description */}
                                                <div className="lg:col-span-1 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider font-bold">Video Description</label>
                                                        <button
                                                            onClick={() => copyToClipboard(currentScript.seoMetadata.description, 'seo-desc')}
                                                            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all font-mono flex items-center gap-1 ${copiedField === 'seo-desc' ? 'bg-green-950/40 border-green-500/30 text-green-400' : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'}`}
                                                        >
                                                            {copiedField === 'seo-desc' ? '✓ Copied!' : '📋 Copy'}
                                                        </button>
                                                    </div>
                                                    <textarea
                                                        rows="5"
                                                        className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 p-3 rounded-2xl text-xs text-neutral-300 font-mono leading-relaxed resize-none outline-none"
                                                        value={currentScript.seoMetadata.description}
                                                        onChange={(e) => {
                                                            const newVal = e.target.value;
                                                            setCurrentScript(prev => ({
                                                                ...prev,
                                                                seoMetadata: { ...prev.seoMetadata, description: newVal }
                                                            }));
                                                        }}
                                                    />
                                                </div>

                                                {/* Hashtags */}
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider font-bold">Hashtags (Space Separated)</label>
                                                        <button
                                                            onClick={() => {
                                                                const tags = Array.isArray(currentScript.seoMetadata.hashtags)
                                                                    ? currentScript.seoMetadata.hashtags.join(' ')
                                                                    : currentScript.seoMetadata.hashtags;
                                                                copyToClipboard(tags, 'seo-hash');
                                                            }}
                                                            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all font-mono flex items-center gap-1 ${copiedField === 'seo-hash' ? 'bg-green-950/40 border-green-500/30 text-green-400' : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'}`}
                                                        >
                                                            {copiedField === 'seo-hash' ? '✓ Copied!' : '📋 Copy'}
                                                        </button>
                                                    </div>
                                                    <textarea
                                                        rows="5"
                                                        className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 p-3 rounded-2xl text-xs text-neutral-300 font-mono leading-relaxed resize-none outline-none"
                                                        value={
                                                            Array.isArray(currentScript.seoMetadata.hashtags)
                                                                ? currentScript.seoMetadata.hashtags.join(' ')
                                                                : currentScript.seoMetadata.hashtags || ''
                                                        }
                                                        onChange={(e) => {
                                                            const newVal = e.target.value;
                                                            setCurrentScript(prev => ({
                                                                ...prev,
                                                                seoMetadata: { 
                                                                    ...prev.seoMetadata, 
                                                                    hashtags: newVal.split(/\s+/).filter(Boolean)
                                                                }
                                                            }));
                                                        }}
                                                    />
                                                </div>

                                                {/* Tags */}
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider font-bold">YouTube Tags</label>
                                                        <button
                                                            onClick={() => copyToClipboard(currentScript.seoMetadata.tags, 'seo-tags')}
                                                            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all font-mono flex items-center gap-1 ${copiedField === 'seo-tags' ? 'bg-green-950/40 border-green-500/30 text-green-400' : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'}`}
                                                        >
                                                            {copiedField === 'seo-tags' ? '✓ Copied!' : '📋 Copy'}
                                                        </button>
                                                    </div>
                                                    <textarea
                                                        rows="5"
                                                        className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 p-3 rounded-2xl text-xs text-neutral-300 font-mono leading-relaxed resize-none outline-none"
                                                        value={currentScript.seoMetadata.tags || ''}
                                                        onChange={(e) => {
                                                            const newVal = e.target.value;
                                                            setCurrentScript(prev => ({
                                                                ...prev,
                                                                seoMetadata: { ...prev.seoMetadata, tags: newVal }
                                                            }));
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* DESKTOP TABLE VIEW */}
 
                                    <div className="hidden md:block bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-neutral-950 border-b border-neutral-800 text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
                                                        <th className="py-4 px-4 w-[85px]">Time</th>
                                                        <th className="py-4 px-3 w-[75px]">Dur</th>
                                                        <th className="py-4 px-4 w-[28%] min-w-[320px]">Voiceover Script</th>
                                                        <th className="py-4 px-4 w-[14%] min-w-[150px]">SFX</th>
                                                        <th className="py-4 px-4 w-[14%] min-w-[150px]">Camera</th>
                                                        <th className="py-4 px-4 min-w-[400px]">Stateless Visual Prompt</th>
                                                        <th className="py-4 px-4 w-[14%] min-w-[150px]">Overlay</th>
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
                                                                        className="bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-2.5 w-full rounded-xl outline-none font-mono text-sm text-center text-neutral-200"
                                                                        value={scene.time}
                                                                        onChange={(e) => handleCellEdit(i, 'time', e.target.value)}
                                                                    />
                                                                </td>
                                                                <td className="py-3.5 px-3">
                                                                    <input 
                                                                        type="number" 
                                                                        className="bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-2.5 w-full rounded-xl outline-none text-center font-mono text-sm text-neutral-200"
                                                                        value={scene.duration}
                                                                        onChange={(e) => handleCellEdit(i, 'duration', parseInt(e.target.value) || 1)}
                                                                    />
                                                                </td>
                                                                <td className="py-3.5 px-4">
                                                                    <div className="relative group">
                                                                        <textarea 
                                                                            rows="5"
                                                                            className="bg-neutral-950 border border-neutral-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 p-3.5 pb-10 w-full rounded-2xl outline-none resize-y leading-relaxed text-sm text-neutral-200 min-h-[140px]"
                                                                            value={scene.voiceover}
                                                                            onChange={(e) => handleCellEdit(i, 'voiceover', e.target.value)}
                                                                        />
                                                                        <button 
                                                                            onClick={() => copyToClipboard(scene.voiceover, `voiceover_${i}`)}
                                                                            className={`absolute bottom-2.5 right-2.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-mono font-bold transition-all z-10 ${
                                                                                copiedField === `voiceover_${i}` 
                                                                                    ? 'bg-green-950 border-green-500 text-green-400' 
                                                                                    : 'bg-neutral-900 border-neutral-800 text-neutral-450 hover:text-white hover:border-neutral-700'
                                                                            }`}
                                                                            title="Copy Voiceover"
                                                                        >
                                                                            {copiedField === `voiceover_${i}` ? '✓ Copied!' : '📋 Copy'}
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                                <td className="py-3.5 px-4">
                                                                    <div className="relative group">
                                                                        <textarea 
                                                                            rows="3"
                                                                            className="bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-3 pb-10 w-full rounded-2xl outline-none resize-y text-sm text-purple-400 font-semibold min-h-[85px]"
                                                                            value={scene.sfx}
                                                                            onChange={(e) => handleCellEdit(i, 'sfx', e.target.value)}
                                                                        />
                                                                        <button 
                                                                            onClick={() => copyToClipboard(scene.sfx, `sfx_${i}`)}
                                                                            className={`absolute bottom-2.5 right-2.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-mono font-bold transition-all z-10 ${
                                                                                copiedField === `sfx_${i}` 
                                                                                    ? 'bg-green-950 border-green-500 text-green-400' 
                                                                                    : 'bg-neutral-900 border-neutral-800 text-neutral-450 hover:text-white hover:border-neutral-700'
                                                                            }`}
                                                                            title="Copy SFX"
                                                                        >
                                                                            {copiedField === `sfx_${i}` ? '✓ Copied!' : '📋 Copy'}
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                                <td className="py-3.5 px-4">
                                                                    <div className="relative group">
                                                                        <textarea 
                                                                            rows="3"
                                                                            className="bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-3 pb-10 w-full rounded-2xl outline-none resize-y text-sm text-sky-400 min-h-[85px]"
                                                                            value={scene.camera}
                                                                            onChange={(e) => handleCellEdit(i, 'camera', e.target.value)}
                                                                        />
                                                                        <button 
                                                                            onClick={() => copyToClipboard(scene.camera, `camera_${i}`)}
                                                                            className={`absolute bottom-2.5 right-2.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-mono font-bold transition-all z-10 ${
                                                                                copiedField === `camera_${i}` 
                                                                                    ? 'bg-green-950 border-green-500 text-green-400' 
                                                                                    : 'bg-neutral-900 border-neutral-800 text-neutral-450 hover:text-white hover:border-neutral-700'
                                                                            }`}
                                                                            title="Copy Camera Settings"
                                                                        >
                                                                            {copiedField === `camera_${i}` ? '✓ Copied!' : '📋 Copy'}
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                                <td className="py-3.5 px-4">
                                                                    <div className="relative group">
                                                                        <textarea 
                                                                            rows="6"
                                                                            className={`bg-neutral-950 border border-neutral-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 p-3.5 pb-10 w-full rounded-2xl outline-none text-sm font-mono leading-normal text-neutral-300 resize-y min-h-[180px] ${isFlagged ? 'border-red-500 focus:border-red-500' : ''}`}
                                                                            value={scene.prompt}
                                                                            onChange={(e) => handleCellEdit(i, 'prompt', e.target.value)}
                                                                        />
                                                                        <button 
                                                                            onClick={() => copyToClipboard(scene.prompt, `prompt_${i}`)}
                                                                            className={`absolute bottom-2.5 right-2.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-mono font-bold transition-all z-10 ${
                                                                                copiedField === `prompt_${i}` 
                                                                                    ? 'bg-green-950 border-green-500 text-green-400' 
                                                                                    : 'bg-neutral-900 border-neutral-800 text-neutral-450 hover:text-white hover:border-neutral-700'
                                                                            }`}
                                                                            title="Copy Prompt"
                                                                        >
                                                                            {copiedField === `prompt_${i}` ? '✓ Copied!' : '📋 Copy'}
                                                                        </button>
                                                                        {isFlagged && (
                                                                            <div className="absolute left-2.5 bottom-2.5 bg-red-650 text-white font-bold text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse font-mono">
                                                                                ⚠️ Pronoun Leak: {scene.qcErrors.join(', ')}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="py-3.5 px-4">
                                                                    <div className="relative group">
                                                                        <textarea 
                                                                            rows="3"
                                                                            className="bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-3 pb-10 w-full rounded-2xl outline-none resize-y text-sm text-amber-500 font-bold min-h-[85px]"
                                                                            value={scene.textOverlay || ''}
                                                                            placeholder="--"
                                                                            onChange={(e) => handleCellEdit(i, 'textOverlay', e.target.value)}
                                                                        />
                                                                        <button 
                                                                            onClick={() => copyToClipboard(scene.textOverlay || '', `overlay_${i}`)}
                                                                            className={`absolute bottom-2.5 right-2.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-mono font-bold transition-all z-10 ${
                                                                                copiedField === `overlay_${i}` 
                                                                                    ? 'bg-green-950 border-green-500 text-green-400' 
                                                                                    : 'bg-neutral-900 border-neutral-800 text-neutral-450 hover:text-white hover:border-neutral-700'
                                                                            }`}
                                                                            title="Copy Overlay Text"
                                                                        >
                                                                            {copiedField === `overlay_${i}` ? '✓ Copied!' : '📋 Copy'}
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* MOBILE CARD VIEW */}
                                    <div className="block md:hidden space-y-4">
                                        {currentScript.scenes.map((scene, i) => {
                                            const isFlagged = scene.qcErrors && scene.qcErrors.length > 0;
                                            return (
                                                <div key={i} className={`bg-neutral-900 border border-neutral-800 p-5 rounded-3xl space-y-4 relative ${isFlagged ? 'border-red-500/50' : ''}`}>
                                                    {/* Scene Header */}
                                                    <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
                                                        <span className="font-extrabold text-sm text-neutral-300 font-mono">Scene #{i + 1}</span>
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-[10px] text-neutral-500 font-mono">Time:</span>
                                                                <input 
                                                                    type="text" 
                                                                    className="bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-1.5 w-16 rounded-xl outline-none font-mono text-xs text-center text-neutral-200"
                                                                    value={scene.time}
                                                                    onChange={(e) => handleCellEdit(i, 'time', e.target.value)}
                                                                />
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-[10px] text-neutral-500 font-mono">Dur:</span>
                                                                <input 
                                                                    type="number" 
                                                                    className="bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-1.5 w-12 rounded-xl outline-none text-center font-mono text-xs text-neutral-200"
                                                                    value={scene.duration}
                                                                    onChange={(e) => handleCellEdit(i, 'duration', parseInt(e.target.value) || 1)}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Voiceover Script */}
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between items-center">
                                                            <label className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider font-bold">Voiceover Script</label>
                                                            <button 
                                                                onClick={() => copyToClipboard(scene.voiceover, `voiceover_m_${i}`)}
                                                                className={`text-[9px] font-bold px-2 py-1 rounded border transition-all font-mono flex items-center gap-1 ${
                                                                    copiedField === `voiceover_m_${i}` 
                                                                        ? 'bg-green-950 border-green-500 text-green-400' 
                                                                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                                                                }`}
                                                            >
                                                                {copiedField === `voiceover_m_${i}` ? '✓ Copied!' : '📋 Copy'}
                                                            </button>
                                                        </div>
                                                        <textarea 
                                                            rows="5"
                                                            className="bg-neutral-950 border border-neutral-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 p-3 w-full rounded-2xl outline-none resize-y leading-relaxed text-sm text-neutral-200 min-h-[120px]"
                                                            value={scene.voiceover}
                                                            onChange={(e) => handleCellEdit(i, 'voiceover', e.target.value)}
                                                        />
                                                    </div>
                                                    
                                                    {/* SFX & Camera */}
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        <div className="space-y-1">
                                                            <div className="flex justify-between items-center">
                                                                <label className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider font-bold">SFX</label>
                                                                <button 
                                                                    onClick={() => copyToClipboard(scene.sfx, `sfx_m_${i}`)}
                                                                    className={`text-[9px] font-bold px-2 py-0.5 rounded border transition-all font-mono flex items-center gap-1 ${
                                                                        copiedField === `sfx_m_${i}` 
                                                                            ? 'bg-green-950 border-green-500 text-green-400' 
                                                                            : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                                                                    }`}
                                                                >
                                                                    {copiedField === `sfx_m_${i}` ? '✓ Copied!' : '📋 Copy'}
                                                                </button>
                                                            </div>
                                                            <textarea 
                                                                rows="3"
                                                                className="bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-2.5 w-full rounded-xl outline-none resize-y text-sm text-purple-400 font-semibold min-h-[80px]"
                                                                value={scene.sfx}
                                                                onChange={(e) => handleCellEdit(i, 'sfx', e.target.value)}
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <div className="flex justify-between items-center">
                                                                <label className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider font-bold">Camera</label>
                                                                <button 
                                                                    onClick={() => copyToClipboard(scene.camera, `camera_m_${i}`)}
                                                                    className={`text-[9px] font-bold px-2 py-0.5 rounded border transition-all font-mono flex items-center gap-1 ${
                                                                        copiedField === `camera_m_${i}` 
                                                                            ? 'bg-green-950 border-green-500 text-green-400' 
                                                                            : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                                                                    }`}
                                                                >
                                                                    {copiedField === `camera_m_${i}` ? '✓ Copied!' : '📋 Copy'}
                                                                </button>
                                                            </div>
                                                            <textarea 
                                                                rows="3"
                                                                className="bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-2.5 w-full rounded-xl outline-none resize-y text-sm text-sky-400 min-h-[80px]"
                                                                value={scene.camera}
                                                                onChange={(e) => handleCellEdit(i, 'camera', e.target.value)}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Stateless Visual Prompt */}
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between items-center">
                                                            <label className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider font-bold">Stateless Visual Prompt</label>
                                                            <button 
                                                                onClick={() => copyToClipboard(scene.prompt, `prompt_m_${i}`)}
                                                                className={`text-[9px] font-bold px-2 py-1 rounded border transition-all font-mono flex items-center gap-1 ${
                                                                    copiedField === `prompt_m_${i}` 
                                                                        ? 'bg-green-950 border-green-500 text-green-400' 
                                                                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                                                                }`}
                                                            >
                                                                {copiedField === `prompt_m_${i}` ? '✓ Copied!' : '📋 Copy'}
                                                            </button>
                                                        </div>
                                                        <div className="relative">
                                                            <textarea 
                                                                rows="6"
                                                                className={`bg-neutral-950 border border-neutral-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 p-3 w-full rounded-2xl outline-none text-sm font-mono leading-normal text-neutral-300 resize-y min-h-[180px] ${isFlagged ? 'border-red-500 focus:border-red-500' : ''}`}
                                                                value={scene.prompt}
                                                                onChange={(e) => handleCellEdit(i, 'prompt', e.target.value)}
                                                            />
                                                            {isFlagged && (
                                                                <div className="absolute right-2 bottom-2 bg-red-650 text-white font-bold text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse font-mono">
                                                                    ⚠️ Pronoun Leak: {scene.qcErrors.join(', ')}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Overlay */}
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between items-center">
                                                            <label className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider font-bold">Overlay Text</label>
                                                            <button 
                                                                onClick={() => copyToClipboard(scene.textOverlay || '', `overlay_m_${i}`)}
                                                                className={`text-[9px] font-bold px-2 py-0.5 rounded border transition-all font-mono flex items-center gap-1 ${
                                                                    copiedField === `overlay_m_${i}` 
                                                                        ? 'bg-green-950 border-green-500 text-green-400' 
                                                                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                                                                }`}
                                                            >
                                                                {copiedField === `overlay_m_${i}` ? '✓ Copied!' : '📋 Copy'}
                                                            </button>
                                                        </div>
                                                        <textarea 
                                                            rows="3"
                                                            className="bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-2.5 w-full rounded-xl outline-none resize-y text-sm text-amber-500 font-bold min-h-[80px]"
                                                            value={scene.textOverlay || ''}
                                                            placeholder="--"
                                                            onChange={(e) => handleCellEdit(i, 'textOverlay', e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
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
                                            onChange={(e) => setApiKey(e.target.value)}
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-mono text-neutral-400 block mb-1.5 font-semibold">Fal.ai API Key (Image Generation)</label>
                                        <input 
                                            type="password" 
                                            placeholder="fal-..."
                                            className="w-full bg-neutral-950 border border-neutral-850 focus:border-blue-500 p-3.5 rounded-xl text-neutral-200 outline-none font-mono text-sm"
                                            value={falApiKey}
                                            onChange={(e) => setFalApiKey(e.target.value)}
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-mono text-neutral-400 block mb-1.5 font-semibold">ElevenLabs API Key (Voiceover TTS)</label>
                                        <input 
                                            type="password" 
                                            placeholder="eleven-labs-key..."
                                            className="w-full bg-neutral-950 border border-neutral-850 focus:border-blue-500 p-3.5 rounded-xl text-neutral-200 outline-none font-mono text-sm"
                                            value={elevenlabsApiKey}
                                            onChange={(e) => setElevenlabsApiKey(e.target.value)}
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-mono text-neutral-400 block mb-1.5 font-semibold">Pipeline Orchestrator Model</label>
                                        <div className="flex gap-2">
                                            <select 
                                                className="flex-1 bg-neutral-950 border border-neutral-855 focus:border-blue-500 p-3.5 rounded-xl text-neutral-200 outline-none font-mono text-sm"
                                                value={model}
                                                onChange={(e) => setModel(e.target.value)}
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
                                                onChange={(e) => setModel(e.target.value)}
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
                                            onChange={(e) => setOutputPath(e.target.value)}
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-mono text-neutral-400 block mb-1.5 font-semibold">Visual DNA Guidelines String</label>
                                        <textarea 
                                            rows="3"
                                            className="w-full bg-neutral-950 border border-neutral-850 focus:border-blue-500 p-3.5 rounded-xl text-neutral-200 outline-none font-mono text-sm resize-none"
                                            value={visualDNA}
                                            onChange={(e) => setVisualDNA(e.target.value)}
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-mono text-neutral-400 block mb-1.5 font-semibold">Style Reference Codes (Comma-separated)</label>
                                        <input 
                                            type="text" 
                                            placeholder="18154.jpg, 18153.jpg, ..."
                                            className="w-full bg-neutral-950 border border-neutral-850 focus:border-blue-500 p-3.5 rounded-xl text-neutral-200 outline-none font-mono text-sm"
                                            value={Array.isArray(styleReferences) ? styleReferences.join(', ') : styleReferences}
                                            onChange={(e) => setStyleReferences(e.target.value.split(',').map(s => s.trim()))}
                                        />
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-neutral-800 flex justify-end">
                                    <button 
                                        onClick={() => {
                                            saveConfig({ apiKey, falApiKey, elevenlabsApiKey, model, outputPath, characters, visualDNA, styleReferences });
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
                                            <span className="bg-blue-900/30 text-blue-400 border border-blue-800/30 text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase">Editable</span>
                                        </div>
                                        <p className="text-xs text-neutral-400">This prefix string is appended to every single visual scene prompt prior to image synthesis, forcing Stable Diffusion / Midjourney seeds to stay strictly on-brand.</p>
                                        <textarea 
                                            value={visualDNA}
                                            onChange={(e) => setVisualDNA(e.target.value)}
                                            rows="4"
                                            className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-4 rounded-2xl text-sm font-mono text-neutral-300 leading-relaxed outline-none resize-none"
                                        />
                                        <div className="flex justify-end">
                                            <button 
                                                onClick={() => {
                                                    saveConfig({ visualDNA });
                                                    alert('Visual DNA Guidelines updated successfully!');
                                                }}
                                                className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition"
                                            >
                                                Apply Guidelines
                                            </button>
                                        </div>
                                    </div>

                                    {/* Linked System Assets */}
                                    <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl shadow-lg space-y-4">
                                        <h3 className="text-xs uppercase tracking-widest font-mono text-neutral-400 font-semibold">Style Reference Tags</h3>
                                        <p className="text-xs text-neutral-400">These identifiers are injected into prompt seeds to trigger stickman style checkpoints. Edit in Settings.</p>
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {styleReferences.map((ref, idx) => (
                                                <div key={ref + idx} className="bg-neutral-950 border border-neutral-850 p-4 rounded-2xl flex items-center justify-between hover:border-blue-500/30 transition-all group">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-lg font-bold group-hover:scale-105 transition-transform">
                                                            🏷️
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-mono font-bold text-white">{ref}</div>
                                                            <div className="text-[10px] text-neutral-500 font-mono">Reference #{idx + 1}</div>
                                                        </div>
                                                    </div>
                                                    <span className="bg-green-950/20 text-green-400 border border-green-900/30 text-[9px] font-mono px-2 py-0.5 rounded uppercase font-bold">Active</span>
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


        </div>
    );
}

export default App;
