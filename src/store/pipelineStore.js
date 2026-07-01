import { create } from 'zustand';
import { DEFAULT_TOPICS, DEFAULT_VISUAL_DNA, DEFAULT_STYLE_REFS } from '../shared/constants.js';

export { DEFAULT_VISUAL_DNA, DEFAULT_STYLE_REFS };

export const usePipelineStore = create((set, get) => ({
    // Global Status
    isGenerating: false,
    synthesisStatus: 'idle',
    compileStatus: 'idle',
    serverStatus: 'Checking...',
    
    // Core Parameters
    apiKey: '',
    geminiApiKey: '',
    falApiKey: '',
    elevenlabsApiKey: '',
    model: 'deepseek/deepseek-v4-flash',
    outputPath: '',
    videoType: 'long',
    targetDuration: 8,
    
    // Artistic Guidelines
    visualDNA: DEFAULT_VISUAL_DNA,
    styleReferences: DEFAULT_STYLE_REFS,
    characters: [],
    
    // Topics
    topicBank: DEFAULT_TOPICS,
    customNicheInput: '',
    selectedTopic: DEFAULT_TOPICS[0],
    
    // Script & Logs
    currentScript: null,
    pipelineLogs: [],
    pipelineStages: [],
    
    // History
    scriptHistory: [],
    historyLoading: false,
    activeHistoryFilename: null,
    
    // Actions
    setField: (field, value) => set({ [field]: value }),
    
    addLog: (msg) => set(state => ({
        pipelineLogs: [...state.pipelineLogs.slice(-499), `[${new Date().toLocaleTimeString()}] ${msg}`]
    })),
    
    buildDefaultStages: (type, duration) => {
        const list = [{ id: 'design', label: '1. Niche & Custom Character Design', status: 'idle' }];
        const numActs = type === 'short' ? 1 : duration;
        for (let i = 1; i <= numActs; i++) {
            list.push({ id: `act${i}`, label: `${i + 1}. Drafting Act ${i} (Dynamic Scenes)`, status: 'idle' });
        }
        list.push({ id: 'qc', label: `${numActs + 2}. Stateless QC Check & Auto-Sanitation`, status: 'idle' });
        set({ pipelineStages: list });
    },
    
    updateStageStatus: (id, status) => set(state => ({
        pipelineStages: state.pipelineStages.map(s => s.id === id ? { ...s, status } : s)
    })),
    
    resetPipelineStages: () => {
        const { videoType, targetDuration } = get();
        get().buildDefaultStages(videoType, targetDuration);
    }
}));
