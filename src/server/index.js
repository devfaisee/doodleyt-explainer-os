import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pipelineRoutes from './routes/pipeline.routes.js';
import configRoutes from './routes/config.routes.js';
import historyRoutes from './routes/history.routes.js';
import { activeJob } from './services/job.service.js';
import { readConfig, isAuthorized } from './utils/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..'); // from src/server to E:/doodleyt

const app = express();

// Standard middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Support large JSON payloads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health endpoint (public)
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), activeJob: activeJob.status, timestamp: Date.now() });
});

// Auth middleware
app.use('/api', (req, res, next) => {
    if (!isAuthorized(req)) {
        return res.status(401).json({ error: 'Unauthorized. Provide a valid X-API-KEY header.' });
    }
    next();
});

// Mount API routes
app.use('/api', pipelineRoutes);
app.use('/api', configRoutes);
app.use('/api', historyRoutes);

// Audio download endpoint
app.get('/api/audio-download/:filename', (req, res) => {
    const filename = path.basename(req.params.filename);
    const config = readConfig();
    const targetDir = config.outputPath || path.join(ROOT_DIR, 'output');
    const filePath = path.join(targetDir, 'audio', filename);
    const isAudio = filename.endsWith('.wav') || filename.endsWith('.mp3');
    if (!isAudio || !fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Audio file not found' });
    }
    res.download(filePath, filename);
});

// Debug endpoint for audio
app.get('/api/debug-audio', (req, res) => {
    const config = readConfig();
    const targetDir = config.outputPath || path.join(ROOT_DIR, 'output');
    const audioDir = path.join(targetDir, 'audio');
    let files = [];
    let exists = fs.existsSync(audioDir);
    if (exists) {
        files = fs.readdirSync(audioDir).map(file => {
            const stat = fs.statSync(path.join(audioDir, file));
            return { name: file, size: stat.size, time: stat.mtime };
        });
    }
    res.json({
        targetDir,
        audioDir,
        exists,
        files
    });
});

// Block sensitive files
app.use((req, res, next) => {
    const sensitiveFiles = ['config.json', 'latest_script.json', 'package.json', 'package-lock.json'];
    const requestedBasename = path.basename(req.path);
    if (sensitiveFiles.includes(requestedBasename)) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    next();
});

// Static file serving for React frontend and media outputs
app.use(express.static(path.join(ROOT_DIR, 'dist')));
app.use('/output', express.static(path.join(ROOT_DIR, 'output')));

// Catch-all to serve index.html for React Router
app.get('/*splat', (req, res) => {
    const indexPath = path.join(ROOT_DIR, 'dist', 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        const rootIndexPath = path.join(ROOT_DIR, 'index.html');
        if (fs.existsSync(rootIndexPath)) {
            res.sendFile(rootIndexPath);
        } else {
            res.status(404).send('index.html not found. Please build the application first (npm run build).');
        }
    }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`[Express] Server successfully started!`);
    console.log(`[Express] Listening on http://localhost:${PORT}`);
});
