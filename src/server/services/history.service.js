import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { SCRIPTS_HISTORY_DIR } from '../utils/config.js';
import { ensureDir } from '../utils/fileSystem.js';

let pgPool = null;
if (process.env.DATABASE_URL) {
    try {
        pgPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
        console.log('[Database] Connecting to PostgreSQL database...');
        
        pgPool.query(`
            CREATE TABLE IF NOT EXISTS scripts_history (
                filename VARCHAR(255) PRIMARY KEY,
                timestamp BIGINT,
                title TEXT,
                category VARCHAR(255),
                video_type VARCHAR(50),
                scene_count INT,
                thumbnail TEXT,
                seo_metadata JSONB,
                assets_synthesized BOOLEAN,
                video_path TEXT,
                thumbnail_path TEXT,
                full_script JSONB
            );
        `).then(() => {
            return pgPool.query(`ALTER TABLE scripts_history ADD COLUMN IF NOT EXISTS estimated_cost JSONB;`);
        }).then(() => {
            console.log('[Database] PostgreSQL table scripts_history is ready.');
        }).catch(err => {
            console.error('[Database] Failed to initialize table:', err);
        });
    } catch (e) {
        console.error('[Database] Failed to initialize pg Pool:', e);
    }
}

export function mapRowToScriptSummary(row) {
    return {
        filename: row.filename,
        timestamp: parseInt(row.timestamp, 10),
        title: row.title || 'Untitled Script',
        category: row.category || '',
        videoType: row.video_type || 'long',
        sceneCount: parseInt(row.scene_count, 10) || 0,
        thumbnail: row.thumbnail || '',
        seoMetadata: row.seo_metadata || null,
        assetsSynthesized: row.assets_synthesized || false,
        videoPath: row.video_path || '',
        thumbnailPath: row.thumbnail_path || '',
        estimatedCost: row.estimated_cost || null
    };
}

export async function saveScriptToHistory(script) {
    try {
        const slug = (script.title || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 60);
        const filename = `${script.timestamp || Date.now()}_${slug}.json`;

        if (pgPool) {
            await pgPool.query(`
                INSERT INTO scripts_history (
                    filename, timestamp, title, category, video_type, scene_count, 
                    thumbnail, seo_metadata, assets_synthesized, video_path, thumbnail_path, estimated_cost, full_script
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                ON CONFLICT (filename) DO UPDATE SET
                    timestamp = EXCLUDED.timestamp,
                    title = EXCLUDED.title,
                    category = EXCLUDED.category,
                    video_type = EXCLUDED.video_type,
                    scene_count = EXCLUDED.scene_count,
                    thumbnail = EXCLUDED.thumbnail,
                    seo_metadata = EXCLUDED.seo_metadata,
                    assets_synthesized = EXCLUDED.assets_synthesized,
                    video_path = EXCLUDED.video_path,
                    thumbnail_path = EXCLUDED.thumbnail_path,
                    estimated_cost = EXCLUDED.estimated_cost,
                    full_script = EXCLUDED.full_script
            `, [
                filename,
                script.timestamp || Date.now(),
                script.title || 'Untitled Script',
                script.category || '',
                script.videoType || 'long',
                (script.scenes || []).length,
                script.thumbnail || '',
                script.seoMetadata ? JSON.stringify(script.seoMetadata) : null,
                script.assetsSynthesized || false,
                script.videoPath || '',
                script.thumbnailPath || '',
                script.estimatedCost ? JSON.stringify(script.estimatedCost) : null,
                JSON.stringify(script)
            ]);
            console.log(`[History] Script saved to PostgreSQL: ${filename}`);
        }

        try {
            ensureDir(SCRIPTS_HISTORY_DIR);
            const filePath = path.join(SCRIPTS_HISTORY_DIR, filename);
            fs.writeFileSync(filePath, JSON.stringify(script, null, 2), 'utf8');
            console.log(`[History] Script saved locally: ${filename}`);
        } catch (localErr) {
            console.error('Error writing history file locally:', localErr);
        }

        return filename;
    } catch (e) {
        console.error('Error saving script to history:', e);
        return null;
    }
}

export async function listScriptHistory() {
    try {
        if (pgPool) {
            const res = await pgPool.query(`
                SELECT filename, timestamp, title, category, video_type, scene_count, 
                       thumbnail, seo_metadata, assets_synthesized, video_path, thumbnail_path, estimated_cost 
                FROM scripts_history 
                ORDER BY timestamp DESC
            `);
            return res.rows.map(row => mapRowToScriptSummary(row));
        }
    } catch (e) {
        console.error('[History] Failed to list scripts from PostgreSQL database, falling back to files:', e);
    }

    try {
        ensureDir(SCRIPTS_HISTORY_DIR);
        const files = fs.readdirSync(SCRIPTS_HISTORY_DIR)
            .filter(f => f.endsWith('.json'))
            .sort((a, b) => b.localeCompare(a)); 
        
        return files.map(filename => {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(SCRIPTS_HISTORY_DIR, filename), 'utf8'));
                return {
                    filename,
                    timestamp: data.timestamp,
                    title: data.title || 'Untitled Script',
                    category: data.category || '',
                    videoType: data.videoType || 'long',
                    sceneCount: (data.scenes || []).length,
                    thumbnail: data.thumbnail || '',
                    seoMetadata: data.seoMetadata || null,
                    assetsSynthesized: data.assetsSynthesized || false,
                    videoPath: data.videoPath || '',
                    thumbnailPath: data.thumbnailPath || '',
                    estimatedCost: data.estimatedCost || null
                };
            } catch (e) {
                return { filename, title: filename, timestamp: 0, sceneCount: 0 };
            }
        });
    } catch (e) {
        console.error('Error listing script history from files:', e);
        return [];
    }
}

export async function loadScriptFromHistory(filename) {
    try {
        if (pgPool) {
            const res = await pgPool.query('SELECT full_script FROM scripts_history WHERE filename = $1', [filename]);
            if (res.rowCount > 0) {
                const fullScript = res.rows[0].full_script;
                return typeof fullScript === 'string' ? JSON.parse(fullScript) : fullScript;
            }
        }
    } catch (e) {
        console.error(`[History] Failed to load script ${filename} from PostgreSQL, falling back to file:`, e);
    }

    try {
        const filePath = path.join(SCRIPTS_HISTORY_DIR, filename);
        if (!fs.existsSync(filePath)) return null;
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        console.error('Error loading script from history file:', e);
        return null;
    }
}

export async function deleteScriptFromHistory(filename) {
    let deletedDb = false;
    let deletedLocal = false;

    try {
        if (pgPool) {
            const res = await pgPool.query('DELETE FROM scripts_history WHERE filename = $1', [filename]);
            deletedDb = res.rowCount > 0;
            console.log(`[History] Deleted from database: ${filename} (success: ${deletedDb})`);
        }
    } catch (e) {
        console.error('[History] Failed to delete script from PostgreSQL:', e);
    }

    try {
        const filePath = path.join(SCRIPTS_HISTORY_DIR, filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            deletedLocal = true;
            console.log(`[History] Deleted local file: ${filename}`);
        }
    } catch (e) {
        console.error('[History] Failed to delete script history file:', e);
    }

    return deletedDb || deletedLocal;
}

export async function updateScriptInHistory(filename, script) {
    try {
        let exists = false;
        if (pgPool) {
            const checkRes = await pgPool.query('SELECT filename FROM scripts_history WHERE filename = $1', [filename]);
            if (checkRes.rowCount > 0) {
                exists = true;
            }
        }
        const filePath = path.join(SCRIPTS_HISTORY_DIR, filename);
        if (fs.existsSync(filePath)) {
            exists = true;
        }

        if (!exists) {
            return false;
        }

        if (pgPool) {
            await pgPool.query(`
                INSERT INTO scripts_history (
                    filename, timestamp, title, category, video_type, scene_count, 
                    thumbnail, seo_metadata, assets_synthesized, video_path, thumbnail_path, estimated_cost, full_script
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                ON CONFLICT (filename) DO UPDATE SET
                    timestamp = EXCLUDED.timestamp,
                    title = EXCLUDED.title,
                    category = EXCLUDED.category,
                    video_type = EXCLUDED.video_type,
                    scene_count = EXCLUDED.scene_count,
                    thumbnail = EXCLUDED.thumbnail,
                    seo_metadata = EXCLUDED.seo_metadata,
                    assets_synthesized = EXCLUDED.assets_synthesized,
                    video_path = EXCLUDED.video_path,
                    thumbnail_path = EXCLUDED.thumbnail_path,
                    estimated_cost = EXCLUDED.estimated_cost,
                    full_script = EXCLUDED.full_script
            `, [
                filename,
                script.timestamp || Date.now(),
                script.title || 'Untitled Script',
                script.category || '',
                script.videoType || 'long',
                (script.scenes || []).length,
                script.thumbnail || '',
                script.seoMetadata ? JSON.stringify(script.seoMetadata) : null,
                script.assetsSynthesized || false,
                script.videoPath || '',
                script.thumbnailPath || '',
                script.estimatedCost ? JSON.stringify(script.estimatedCost) : null,
                JSON.stringify(script)
            ]);
            console.log(`[History] Database entry updated/upserted: ${filename}`);
        }
        
        try {
            ensureDir(SCRIPTS_HISTORY_DIR);
            fs.writeFileSync(filePath, JSON.stringify(script, null, 2), 'utf8');
            console.log(`[History] Local file updated: ${filename}`);
        } catch (localErr) {
            console.error('Error writing local file on update:', localErr);
        }
        return true;
    } catch (e) {
        console.error('Error updating script in history:', e);
        return false;
    }
}
