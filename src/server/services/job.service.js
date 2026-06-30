import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';
import { LATEST_SCRIPT_FILE } from '../utils/config.js';

export const jobQueue = [];

export function processQueue(startBackendScriptGeneration) {
    if (jobQueue.length > 0) {
        const nextJob = jobQueue.shift();
        console.log(`[Queue] Processing next job. Remaining in queue: ${jobQueue.length}`);
        const { topicTheme, videoType, targetDuration, apiKey, model } = nextJob;
        startBackendScriptGeneration(topicTheme, videoType, targetDuration, apiKey, model);
    }
}

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

export function writeLatestScript(script) {
    try {
        fs.writeFileSync(LATEST_SCRIPT_FILE, JSON.stringify(script, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error('Error writing latest script:', e);
        return false;
    }
}

export function buildDefaultStages(type, duration) {
    const list = [{ id: 'design', label: '1. Niche & Custom Character Design', status: 'idle' }];
    const numActs = type === 'short' ? 1 : duration;
    for (let i = 1; i <= numActs; i++) {
        list.push({ id: `act${i}`, label: `${i + 1}. Drafting Act ${i} (Dynamic Scenes)`, status: 'idle' });
    }
    list.push({ id: 'qc', label: `${numActs + 2}. Stateless QC Check & Auto-Sanitation`, status: 'idle' });
    return list;
}

export const activeJob = {
    status: 'idle', // 'idle' | 'running' | 'completed' | 'failed' | 'synthesis_complete'
    logs: [],
    stages: [],
    script: readLatestScript(),
    error: null,
    topicTheme: '',
    videoType: 'long',
    targetDuration: 8,
    llmTokens: { input: 0, output: 0 }
};

export function addJobLog(msg) {
    const logLine = `[${new Date().toLocaleTimeString()}] ${msg}`;
    activeJob.logs.push(logLine);
    try { logger.info(logLine); } catch(e) { console.log(logLine); }
}

export function updateJobStageStatus(stageId, status, labelUpdate = null) {
    activeJob.stages = activeJob.stages.map(s => {
        if (s.id === stageId) {
            const updated = { ...s, status };
            if (labelUpdate) updated.label = labelUpdate;
            return updated;
        }
        return s;
    });
}
