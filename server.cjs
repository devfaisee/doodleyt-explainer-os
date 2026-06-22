const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const PORT = 3000;
const CONFIG_FILE = path.join(__dirname, 'config.json');

// Helper to read config
function readConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('Error reading config:', e);
    }
    return {
        apiKey: '',
        model: 'deepseek/deepseek-v4-flash',
        outputPath: path.join(__dirname, 'output'),
        characters: [
            { name: 'BOB', description: 'Stick figure man, round head, thin body, red baseball cap forward, blue hoodie, black pants, white sneakers, large eyebrows, goofy smile' },
            { name: 'SARA', description: 'Female stick figure, long hair drawn as squiggly lines, pink shirt, blue skirt, glasses, surprised expression' }
        ]
    };
}

// Helper to write config
function writeConfig(config) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error('Error writing config:', e);
        return false;
    }
}

// Ensure output directory exists
function ensureDir(dirPath) {
    try {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        return true;
    } catch (e) {
        console.error('Error creating directory:', e);
        return false;
    }
}

// Native HTTPS POST request helper
function httpsPost(url, headers, body) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const options = {
            hostname: u.hostname,
            path: u.pathname + u.search,
            method: 'POST',
            headers: {
                ...headers,
                'Content-Length': Buffer.byteLength(body)
            }
        };

        const req = https.request(options, (res) => {
            let data = [];
            res.on('data', (chunk) => data.push(chunk));
            res.on('end', () => {
                const buf = Buffer.concat(data);
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ statusCode: res.statusCode, body: buf, headers: res.headers });
                } else {
                    reject(new Error(`HTTP status ${res.statusCode}: ${buf.toString()}`));
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(body);
        req.end();
    });
}

// Native HTTPS GET request helper
function httpsGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = [];
            res.on('data', (chunk) => data.push(chunk));
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(Buffer.concat(data));
                } else {
                    reject(new Error(`HTTP status ${res.statusCode}`));
                }
            });
        }).on('error', (e) => reject(e));
    });
}

// Generate valid silent PCM WAV buffer
function getSilentWavBuffer(durationSeconds = 2) {
    const sampleRate = 8000;
    const numChannels = 1;
    const bitsPerSample = 8;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = Math.ceil(durationSeconds * byteRate);
    const chunkSize = 36 + dataSize;
    
    const buffer = Buffer.alloc(44 + dataSize);
    
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(chunkSize, 4);
    buffer.write('WAVE', 8);
    
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);
    
    buffer.fill(128, 44);
    return buffer;
}

const MOCK_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAoAAAAFACAIAAADUeu9RAAAAJ0lEQVR42u3BAQEAAACAkP6v7ggAAAAAAAAAAAAAAAAAAAAAgAcMDgAB91rO1gAAAABJRU5ErkJggg==";

const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;

    // API Routes
    if (pathname === '/api/config' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(readConfig()));
        return;
    }

    if (pathname === '/api/config' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const newConfig = JSON.parse(body);
                const currentConfig = readConfig();
                const mergedConfig = { ...currentConfig, ...newConfig };
                writeConfig(mergedConfig);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, config: mergedConfig }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }

    if (pathname === '/api/save' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { filename, content } = data;
                const config = readConfig();
                
                const targetDir = config.outputPath || path.join(__dirname, 'output');
                ensureDir(targetDir);

                const filePath = path.join(targetDir, filename);
                fs.writeFileSync(filePath, typeof content === 'object' ? JSON.stringify(content, null, 2) : content, 'utf8');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, filePath }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }
    if (pathname === '/api/synthesize-assets' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const { scenes, falApiKey, elevenlabsApiKey, outputPath } = data;
                
                const targetDir = outputPath || path.join(__dirname, 'output');
                const imagesDir = path.join(targetDir, 'images');
                const audioDir = path.join(targetDir, 'audio');
                
                ensureDir(targetDir);
                ensureDir(imagesDir);
                ensureDir(audioDir);
                
                console.log(`Starting media synthesis for ${scenes.length} scenes...`);
                
                // Synthesize each scene sequentially
                for (let i = 0; i < scenes.length; i++) {
                    const scene = scenes[i];
                    const indexStr = (i + 1).toString().padStart(3, '0');
                    const imgPath = path.join(imagesDir, `scene_${indexStr}.png`);
                    const audioPath = path.join(audioDir, `scene_${indexStr}.wav`);
                    
                    // 1. Image synthesis (Fal.ai Flux Schnell)
                    if (falApiKey) {
                        try {
                            const payload = JSON.stringify({
                                prompt: scene.prompt,
                                image_size: "16:9",
                                num_inference_steps: 4,
                                sync_mode: true
                            });
                            
                            const res = await httpsPost(
                                "https://fal.run/fal-ai/flux/schnell",
                                {
                                    "Authorization": `Key ${falApiKey}`,
                                    "Content-Type": "application/json"
                                },
                                payload
                            );
                            
                            const resJson = JSON.parse(res.body.toString());
                            if (resJson.images && resJson.images[0]) {
                                const imgBuffer = await httpsGet(resJson.images[0].url);
                                fs.writeFileSync(imgPath, imgBuffer);
                                console.log(`[Fal.ai] Saved scene_${indexStr}.png`);
                            } else {
                                throw new Error("No image URL returned");
                            }
                        } catch (err) {
                            console.error(`Fal.ai failed for scene ${i+1}: ${err.message}. Falling back to mock PNG.`);
                            fs.writeFileSync(imgPath, Buffer.from(MOCK_PNG_BASE64, 'base64'));
                        }
                    } else {
                        // Mock fallback
                        fs.writeFileSync(imgPath, Buffer.from(MOCK_PNG_BASE64, 'base64'));
                    }
                    
                    // 2. Audio Synthesis (ElevenLabs voiceover TTS)
                    if (elevenlabsApiKey && scene.voiceover) {
                        try {
                            const payload = JSON.stringify({
                                text: scene.voiceover,
                                model_id: "eleven_monolingual_v1",
                                voice_settings: { stability: 0.5, similarity_boost: 0.75 }
                            });
                            
                            // Using standard Rachel voice: 21m00Tcm4TlvDq8ikWAM
                            const res = await httpsPost(
                                "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM",
                                {
                                    "xi-api-key": elevenlabsApiKey,
                                    "Content-Type": "application/json"
                                },
                                payload
                            );
                            fs.writeFileSync(audioPath, res.body);
                            console.log(`[Elevenlabs] Saved scene_${indexStr}.wav`);
                        } catch (err) {
                            console.error(`ElevenLabs failed for scene ${i+1}: ${err.message}. Falling back to mock silent WAV.`);
                            const duration = parseFloat(scene.duration) || 2;
                            fs.writeFileSync(audioPath, getSilentWavBuffer(duration));
                        }
                    } else {
                        const duration = parseFloat(scene.duration) || 2;
                        fs.writeFileSync(audioPath, getSilentWavBuffer(duration));
                    }
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true, 
                    imagesDir, 
                    audioDir 
                }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    if (pathname === '/api/assemble-video' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const { scenes, outputPath } = data;
                
                const targetDir = outputPath || path.join(__dirname, 'output');
                const imagesDir = path.join(targetDir, 'images');
                const audioDir = path.join(targetDir, 'audio');
                
                // Ensure ffmpeg is in path
                exec('ffmpeg -version', (err, stdout, stderr) => {
                    if (err) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: "FFmpeg is not installed or not in system PATH. Final compilation requires FFmpeg." }));
                        return;
                    }
                    
                    try {
                        const tempVideoFiles = [];
                        const inputsTxtPath = path.join(targetDir, 'inputs.txt');
                        let inputsTxtContent = '';
                        
                        console.log("Compiling individual scene videos...");
                        
                        // Compile each scene individually using loop image and WAV audio
                        let compilePromises = scenes.map((scene, i) => {
                            return new Promise((resolveScene, rejectScene) => {
                                const indexStr = (i + 1).toString().padStart(3, '0');
                                const imgPath = path.join(imagesDir, `scene_${indexStr}.png`);
                                const audioPath = path.join(audioDir, `scene_${indexStr}.wav`);
                                const tempSceneVideo = path.join(targetDir, `temp_scene_${indexStr}.mp4`);
                                const duration = parseFloat(scene.duration) || 2;
                                
                                // Command: Loop 1 image + WAV -> MP4
                                const cmd = `ffmpeg -y -loop 1 -framerate 25 -i "${imgPath}" -i "${audioPath}" -c:v libx264 -t ${duration} -pix_fmt yuv420p -vf "scale=1280:720" -shortest "${tempSceneVideo}"`;
                                
                                exec(cmd, (sceneErr, sceneStdout, sceneStderr) => {
                                    if (sceneErr) {
                                        console.error(`Error rendering scene ${indexStr}:`, sceneErr);
                                        rejectScene(sceneErr);
                                    } else {
                                        tempVideoFiles.push(tempSceneVideo);
                                        resolveScene();
                                    }
                                });
                            });
                        });
                        
                        Promise.all(compilePromises).then(() => {
                            // Sort temp files to ensure chronological order
                            tempVideoFiles.sort();
                            
                            // Write inputs.txt content for FFmpeg concat demuxer
                            tempVideoFiles.forEach(file => {
                                const escapedPath = file.replace(/\\/g, '/');
                                inputsTxtContent += `file '${escapedPath}'\n`;
                            });
                            fs.writeFileSync(inputsTxtPath, inputsTxtContent, 'utf8');
                            
                            const finalVideoPath = path.join(targetDir, 'final_output.mp4');
                            
                            // Concat copy command
                            const concatCmd = `ffmpeg -y -f concat -safe 0 -i "${inputsTxtPath}" -c copy "${finalVideoPath}"`;
                            
                            exec(concatCmd, (concatErr, concatStdout, concatStderr) => {
                                // Clean up temp scene mp4s and inputs.txt
                                tempVideoFiles.forEach(file => {
                                    try { fs.unlinkSync(file); } catch(e){}
                                });
                                try { fs.unlinkSync(inputsTxtPath); } catch(e){}
                                
                                if (concatErr) {
                                    res.writeHead(500, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({ error: `Concatenation failed: ${concatErr.message}` }));
                                } else {
                                    const stats = fs.statSync(finalVideoPath);
                                    res.writeHead(200, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({ 
                                        success: true, 
                                        filePath: finalVideoPath,
                                        fileSize: stats.size
                                    }));
                                }
                            });
                        }).catch(compileErr => {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: `Scene compilation failed: ${compileErr.message}` }));
                        });
                        
                    } catch (innerErr) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: innerErr.message }));
                    }
                });
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // Serve Frontend
    if (pathname === '/' || pathname === '/index.html') {
        const indexPath = path.join(__dirname, 'dist', 'index.html');
        if (fs.existsSync(indexPath)) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(fs.readFileSync(indexPath));
        } else {
            const rootIndexPath = path.join(__dirname, 'index.html');
            if (fs.existsSync(rootIndexPath)) {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(fs.readFileSync(rootIndexPath));
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('index.html not found. Please build the application first (npm run build).');
            }
        }
        return;
    }

    // Serve static files if they exist (checks dist folder first, then root)
    let filePath = path.join(__dirname, 'dist', pathname);
    if (!(fs.existsSync(filePath) && fs.statSync(filePath).isFile())) {
        filePath = path.join(__dirname, pathname);
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.wav': 'audio/wav',
            '.mp4': 'video/mp4',
        };
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(fs.readFileSync(filePath));
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
});

// Find network IPs
function getNetworkIPs() {
    const interfaces = os.networkInterfaces();
    const addresses = [];
    for (const k in interfaces) {
        for (const k2 in interfaces[k]) {
            const address = interfaces[k][k2];
            if (address.family === 'IPv4' && !address.internal) {
                addresses.push(address.address);
            }
        }
    }
    return addresses;
}

server.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`🚀 Explainer OS v2026 local server is running!`);
    console.log(`👉 Access on this machine: http://localhost:${PORT}`);
    
    const ips = getNetworkIPs();
    if (ips.length > 0) {
        console.log(`👉 Access from any device on your local network:`);
        ips.forEach(ip => {
            console.log(`   http://${ip}:${PORT}`);
        });
    }
    console.log(`==================================================`);
});
