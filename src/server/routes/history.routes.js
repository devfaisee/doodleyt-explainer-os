import { Router } from 'express';
import { isAuthorized } from '../utils/config.js';
import { writeLatestScript } from '../services/job.service.js';
import path from 'path';
import {
    listScriptHistory,
    loadScriptFromHistory,
    deleteScriptFromHistory,
    updateScriptInHistory
} from '../services/history.service.js';

const router = Router();

router.get('/scripts-history', async (req, res) => {
    try {
        const scripts = await listScriptHistory();
        res.json({ scripts });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/load-script', async (req, res) => {
    const filename = req.query.filename;
    if (!filename) {
        return res.status(400).json({ error: 'filename query parameter is required' });
    }
    const safeFilename = path.basename(filename);
    try {
        const script = await loadScriptFromHistory(safeFilename);
        if (!script) {
            return res.status(404).json({ error: 'Script not found in history' });
        }
        res.json({ script });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/delete-script', async (req, res) => {
    if (!isAuthorized(req)) {
        return res.status(401).json({ error: 'Unauthorized. Provide a valid X-API-KEY header.' });
    }
    try {
        const { filename } = req.body;
        const safeFilename = path.basename(filename);
        const deleted = await deleteScriptFromHistory(safeFilename);
        res.json({ success: deleted });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

router.post('/update-script-history', async (req, res) => {
    if (!isAuthorized(req)) {
        return res.status(401).json({ error: 'Unauthorized. Provide a valid X-API-KEY header.' });
    }
    try {
        const { filename, script } = req.body;
        if (!filename || !script) throw new Error('filename and script are required');
        const safeFilename = path.basename(filename);
        const updated = await updateScriptInHistory(safeFilename, script);
        if (!updated) {
            return res.status(404).json({ error: 'Script not found in history' });
        }
        writeLatestScript(script);
        res.json({ success: true });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

export default router;
