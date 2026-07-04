import { Router } from 'express';
import { readConfig, writeConfig } from '../utils/config.js';
import { ensureDir } from '../utils/fileSystem.js';
import path from 'path';
import fs from 'fs';

const router = Router();

router.get('/config', (req, res) => {
    const config = readConfig();
    const safeConfig = {
        ...config,
        apiKey: config.apiKey ? '***' + config.apiKey.slice(-4) : '',
        geminiApiKey: config.geminiApiKey ? '***' + config.geminiApiKey.slice(-4) : '',
        elevenlabsApiKey: config.elevenlabsApiKey ? '***' + config.elevenlabsApiKey.slice(-4) : '',
        falApiKey: config.falApiKey ? '***' + config.falApiKey.slice(-4) : '',
        replicateApiKey: config.replicateApiKey ? '***' + config.replicateApiKey.slice(-4) : ''
    };
    res.json(safeConfig);
});

router.post('/config', (req, res) => {
    try {
        const newConfig = req.body;
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
        res.json({ success: true, config: mergedConfig });
    } catch (e) {
        res.status(400).json({ error: 'Invalid JSON' });
    }
});

router.post('/save', (req, res) => {
    try {
        const { filename, content } = req.body;
        const config = readConfig();
        
        const targetDir = config.outputPath || path.join(process.cwd(), 'output');
        ensureDir(targetDir);

        const safeFilename = path.basename(filename || 'untitled.json');
        if (!safeFilename || safeFilename !== filename) {
            return res.status(400).json({ error: 'Invalid filename' });
        }

        const filePath = path.join(targetDir, safeFilename);
        if (!path.resolve(filePath).startsWith(path.resolve(targetDir))) {
            return res.status(403).json({ error: 'Forbidden.' });
        }

        fs.writeFileSync(filePath, typeof content === 'object' ? JSON.stringify(content, null, 2) : content, 'utf8');

        res.json({ success: true, filePath });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
