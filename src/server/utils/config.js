import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..'); // from src/server/utils to E:/doodleyt

export const CONFIG_FILE = path.join(ROOT_DIR, 'config.json');
export const FIXATED_KEY = process.env.OPENROUTER_API_KEY || '';
export const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
export const STYLE_REFS_DIR = path.join(ROOT_DIR, 'style_references');
export const SCRIPTS_HISTORY_DIR = path.join(OUTPUT_DIR, 'scripts_history');
export const LATEST_SCRIPT_FILE = path.join(OUTPUT_DIR, 'latest_script.json');

// Helper to read config
export function readConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('Error reading config:', e);
    }
    return {
        apiKey: FIXATED_KEY,
        model: 'deepseek/deepseek-v4-flash',
        outputPath: OUTPUT_DIR,
        visualDNA: "Minimalist hand-drawn 2D vector-style cartoon illustration (similar to YouTube channel Zenn). Clean, smooth, non-jagged black felt-pen outlines and solid flat color fills. Exaggerated comical cartoon expressions (wide cartoon eyes, sweating, gaping mouth). Backgrounds are high-contrast and completely flat: solid white, bright solid yellow, deep solid black, or simple flat colored environments (no gradients, no realistic shading, no 3D rendering). Features bold, hand-drawn uppercase text overlays with thick black outlines (typically in bright yellow, red, or white) and clean, hand-drawn red pointing arrows or white speech bubbles where appropriate. Simple, clean, cute cartoon representations of characters, animals, and objects instead of complex or messy sketches. Perfect clean outlines (no messy or pixelated lines, no scribbled draft lines).",
        styleReferences: ['18154.jpg', '18153.jpg', '18152.jpg', '18142.jpg', '18146.jpg', '18143.jpg', '18147.jpg', '18151.jpg', '18149.jpg', '18159.jpg'],
        characters: [
            { name: 'BOB', description: 'Stick figure man, round head, thin body, red baseball cap forward, blue hoodie, black pants, white sneakers, large eyebrows, goofy smile' },
            { name: 'SARA', description: 'Female stick figure, long hair drawn as squiggly lines, pink shirt, blue skirt, glasses, surprised expression' }
        ]
    };
}

// Helper to write config
export function writeConfig(config) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error('Error writing config:', e);
        return false;
    }
}

export function getEffectiveApiKey(providedKey) {
    if (providedKey && providedKey.trim().length > 10) {
        return providedKey.trim();
    }
    const config = readConfig();
    if (config.apiKey && config.apiKey.trim().length > 10) {
        return config.apiKey.trim();
    }
    return FIXATED_KEY;
}

export function isAuthorized(req) {
    const headerKey = (req.headers['x-api-key'] || req.headers['x-api'] || '').toString().trim();
    if (!headerKey || headerKey.length < 8) return false;
    
    // compare against explicit ADMIN_API_KEY env, or stored config apiKey, or FIXATED_KEY
    if (process.env.ADMIN_API_KEY && process.env.ADMIN_API_KEY === headerKey) return true;
    
    const cfg = readConfig();
    if (cfg.apiKey && cfg.apiKey === headerKey) return true;
    if (FIXATED_KEY && FIXATED_KEY === headerKey) return true;
    
    return false;
}
