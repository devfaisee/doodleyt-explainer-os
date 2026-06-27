const http = require('http');
const fs = require('fs');
const path = require('path');

// 1. Parse command line arguments
const args = process.argv.slice(2);
let geminiApiKey = "";
let topicTheme = "Why your body fights sleep at 3 AM";
let falApiKey = "";
let elevenlabsApiKey = "";

for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--gemini=')) {
        geminiApiKey = args[i].split('=')[1].trim();
    } else if (args[i].startsWith('--topic=')) {
        topicTheme = args[i].split('=')[1].trim();
    } else if (args[i].startsWith('--fal=')) {
        falApiKey = args[i].split('=')[1].trim();
    } else if (args[i].startsWith('--elevenlabs=')) {
        elevenlabsApiKey = args[i].split('=')[1].trim();
    }
}

// 2. Fetch OpenRouter API key from server config or process environment
let openRouterApiKey = process.env.OPENROUTER_API_KEY || "";
try {
    const configPath = path.join(__dirname, '..', 'config.json');
    if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.apiKey) openRouterApiKey = config.apiKey;
        if (!geminiApiKey && config.geminiApiKey) geminiApiKey = config.geminiApiKey;
        if (!falApiKey && config.falApiKey) falApiKey = config.falApiKey;
        if (!elevenlabsApiKey && config.elevenlabsApiKey) elevenlabsApiKey = config.elevenlabsApiKey;
    }
} catch (e) {
    console.error("Failed to read local config.json:", e.message);
}

if (!openRouterApiKey) {
    console.error("❌ Error: OpenRouter API key not found in process environment or config.json.");
    process.exit(1);
}

const BASE_URL = 'http://localhost:3000';
const OUTPUTS_DIR = "E:\\doodleyt\\outputs";

console.log("=========================================");
console.log("🚀 STARTING AUTOMATED SHORTS TEST RUN");
console.log(`Topic: "${topicTheme}"`);
console.log(`OpenRouter Key: ${openRouterApiKey ? "Configured" : "Missing"}`);
console.log(`Gemini API Key: ${geminiApiKey ? "Provided" : "Not Provided (will use Fal.ai/Mock fallback)"}`);
console.log(`Fal.ai API Key: ${falApiKey ? "Provided" : "Not Provided (will use Mock fallback)"}`);
console.log("=========================================\n");

// HTTP POST helper
function post(urlPath, data) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(data);
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: urlPath,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        resolve(body);
                    }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${body}`));
                }
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

// HTTP GET helper
function get(urlPath) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: urlPath,
            method: 'GET'
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        resolve(body);
                    }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${body}`));
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Poll active job status
async function waitForJobCompletion(stageName) {
    let lastLogIndex = 0;
    while (true) {
        await delay(3000);
        const statusData = await get('/api/generation-status');
        
        // Print new logs
        const logs = statusData.logs || [];
        if (logs.length > lastLogIndex) {
            for (let i = lastLogIndex; i < logs.length; i++) {
                console.log(logs[i]);
            }
            lastLogIndex = logs.length;
        }

        if (statusData.status === 'completed') {
            console.log(`\n✅ Stage [${stageName}] completed successfully!\n`);
            return statusData.script;
        } else if (statusData.status === 'failed') {
            throw new Error(`Stage [${stageName}] failed: ${statusData.error}`);
        } else if (statusData.status === 'idle') {
            throw new Error(`Stage [${stageName}] was cancelled or reset to idle.`);
        }
    }
}

async function run() {
    try {
        // --- PHASE 1: SCRIPT WRITING ---
        console.log("📝 Phase 1: Requesting script generation from OpenRouter (DeepSeek V4)...");
        const scriptStartRes = await post('/api/generate-script', {
            topicTheme,
            videoType: "short",
            targetDuration: 1,
            apiKey: openRouterApiKey,
            model: "deepseek/deepseek-v4-flash"
        });
        console.log("Script generation started. Polling logs...");
        
        const generatedScript = await waitForJobCompletion("Script Writing");
        
        // --- PHASE 2: ASSET SYNTHESIS ---
        console.log("🎨 Phase 2: Requesting media asset synthesis (images & voiceover)...");
        await post('/api/synthesize-assets', {
            script: generatedScript,
            apiKey: openRouterApiKey,
            falApiKey,
            elevenlabsApiKey,
            geminiApiKey,
            outputPath: OUTPUTS_DIR
        });
        console.log("Asset synthesis started. Polling logs...");
        
        const synthesizedScript = await waitForJobCompletion("Asset Synthesis");

        // --- PHASE 3: VIDEO COMPILATION ---
        console.log("🎬 Phase 3: Requesting video compilation (FFmpeg stitch)...");
        await post('/api/assemble-video', {
            script: synthesizedScript,
            outputPath: OUTPUTS_DIR
        });
        console.log("Video compilation started. Polling logs...");
        
        const compiledScript = await waitForJobCompletion("Video Compilation");

        console.log("=========================================");
        console.log("🎉 PIPELINE COMPLETED SUCCESSFULLY!");
        console.log(`🎬 Video saved to local outputs: ${compiledScript.videoPath}`);
        console.log(`📍 Absolute local file: ${path.join(OUTPUTS_DIR, path.basename(compiledScript.videoPath))}`);
        console.log("=========================================");

    } catch (err) {
        console.error("\n❌ Pipeline failed with error:", err.message);
        process.exit(1);
    }
}

run();
