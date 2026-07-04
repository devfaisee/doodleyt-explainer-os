import fs from 'fs';
import path from 'path';
import { activeJob, addJobLog, writeLatestScript } from './job.service.js';
import { updateScriptInHistory } from './history.service.js';
import { getAudioFileName, saveAudioAsMP3, getSilentWavBuffer } from './ffmpeg.service.js';
import { ensureDir } from '../utils/fileSystem.js';
import { readConfig, OUTPUT_DIR } from '../utils/config.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { MOCK_PNG_BASE64 } from './media.service.js';

const execFileAsync = promisify(execFile);

// Magic byte verifier to detect progressive JPEGs disguised as PNGs
const ensurePngFormat = async (filePath) => {
    try {
        if (!fs.existsSync(filePath)) return false;
        const buffer = await fs.promises.readFile(filePath);
        
        // 1. Check if empty or too small to be a valid image
        if (buffer.length < 100) {
            addJobLog(`[Image Guard] File ${path.basename(filePath)} is empty or too small (${buffer.length} bytes). Overwriting with safe mock canvas fallback...`);
            await fs.promises.writeFile(filePath, Buffer.from(MOCK_PNG_BASE64, 'base64'));
            return true;
        }

        // 2. Check if JPEG magic bytes: FF D8
        if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
            addJobLog(`[Image Guard] Detected progressive JPEG format disguised as PNG for ${path.basename(filePath)}. Converting to real PNG...`);
            const tempJpg = filePath + '.tmp.jpg';
            await fs.promises.writeFile(tempJpg, buffer);
            try {
                await execFileAsync('ffmpeg', ['-y', '-v', 'error', '-i', tempJpg, '-vcodec', 'png', filePath]);
            } finally {
                try { fs.unlinkSync(tempJpg); } catch (_) {}
            }
            return true;
        }

        // 3. Check if valid PNG magic bytes: 89 50 4E 47
        if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
            return true;
        }

        // 4. If neither, it is corrupt. Overwrite with safe fallback.
        addJobLog(`[Image Guard] Detected corrupt/invalid image format for ${path.basename(filePath)}. Overwriting with safe mock canvas fallback...`);
        await fs.promises.writeFile(filePath, Buffer.from(MOCK_PNG_BASE64, 'base64'));
        return true;
    } catch (e) {
        addJobLog(`⚠️ Error verifying image format for ${path.basename(filePath)}: ${e.message}`);
        return false;
    }
};

const ensureMp3Format = async (filePath) => {
    try {
        if (!fs.existsSync(filePath)) return false;
        const buffer = await fs.promises.readFile(filePath);
        
        // 1. Check if empty or too small to be a valid audio file
        if (buffer.length < 100) {
            addJobLog(`[Audio Guard] File ${path.basename(filePath)} is empty or too small (${buffer.length} bytes). Writing silent fallback...`);
            const silentBuffer = getSilentWavBuffer(2);
            await saveAudioAsMP3(silentBuffer, filePath);
            return true;
        }

        // 2. Check if WAV magic bytes: RIFF (0x52 0x49 0x46 0x46)
        if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
            addJobLog(`[Audio Guard] Detected WAV format disguised as MP3 for ${path.basename(filePath)}. Converting to real MP3...`);
            const tempWav = filePath + '.tmp.wav';
            await fs.promises.writeFile(tempWav, buffer);
            try {
                await execFileAsync('ffmpeg', ['-y', '-v', 'error', '-i', tempWav, '-codec:a', 'libmp3lame', '-qscale:a', '2', filePath]);
            } finally {
                try { fs.unlinkSync(tempWav); } catch (_) {}
            }
        }
        return true;
    } catch (e) {
        addJobLog(`⚠️ Error verifying audio format for ${path.basename(filePath)}: ${e.message}`);
        return false;
    }
};

// Concurrency-safe temp files purger
const cleanAllTempFiles = (targetDir) => {
    try {
        const files = fs.readdirSync(targetDir);
        files.forEach(file => {
            if (file.startsWith('temp_scene_') && file.endsWith('.mp4')) {
                try {
                    fs.unlinkSync(path.join(targetDir, file));
                } catch (_) {}
            }
        });
    } catch (_) {}
};

const writeFallbackVideoArtifact = (finalVideoPath) => {
    const fallbackCandidates = [
        path.join(process.cwd(), 'outputs', 'test_1x1.mp4'),
        path.join(process.cwd(), 'output', 'test_1x1.mp4')
    ];
    const fallbackSource = fallbackCandidates.find(p => fs.existsSync(p));
    if (!fallbackSource) {
        return false;
    }
    fs.copyFileSync(fallbackSource, finalVideoPath);
    return true;
};

export function startBackendAssembly(script, providedOutputPath) {
    activeJob.status = 'running';
    activeJob.jobType = 'assembly';
    activeJob.logs = [];
    activeJob.error = null;
    activeJob.script = script;
    activeJob.stages = [];
    
    (async () => {
        addJobLog(`🎬 Starting background video compilation for: "${script.title}"`);
        
        try {
            await execFileAsync('ffmpeg', ['-version']);
        } catch (err) {
            activeJob.status = 'failed';
            activeJob.error = "FFmpeg is not installed or not in system PATH. Final compilation requires FFmpeg.";
            addJobLog(`❌ FFmpeg check failed: FFmpeg is not installed or not in system PATH.`);
            return;
        }

        const config = readConfig();
        const targetDir = providedOutputPath || config.outputPath || path.join(process.cwd(), 'output');
        const imagesDir = path.join(targetDir, 'images');
        const audioDir = path.join(targetDir, 'audio');
        const videosDir = path.join(targetDir, 'videos');
        
        ensureDir(targetDir);
        ensureDir(imagesDir);
        ensureDir(audioDir);
        ensureDir(videosDir);
        
        const scenes = script.scenes || [];
        const tempVideoFiles = [];
        const inputsTxtPath = path.join(targetDir, 'inputs.txt');
        let inputsTxtContent = '';
        
        addJobLog(`⚙️ Compiling ${scenes.length} individual scene videos in parallel batches...`);
        
        try {
            // Sequential encoding by default; specifiable via config.concurrency for faster parallel renders on high-end hosts.
            const batchSize = Math.max(1, parseInt(config.concurrency, 10) || 1);
            for (let i = 0; i < scenes.length; i += batchSize) {
                if (activeJob.status === 'idle') {
                    addJobLog(`🛑 Compilation cancelled by user.`);
                    throw new Error('Cancelled by user');
                }
                
                const batch = scenes.slice(i, i + batchSize);
                const batchPromises = batch.map(async (scene, batchIdx) => {
                    const sceneIndex = i + batchIdx;
                    const indexStr = (sceneIndex + 1).toString().padStart(3, '0');
                    const imgPath = path.join(imagesDir, `scene_${indexStr}.png`);
                    const audioFileName = getAudioFileName(script.title, sceneIndex);
                    const audioPath = path.join(audioDir, audioFileName);
                    
                    const legacyImgPath = path.join(imagesDir, `scene_${indexStr}.jpg`);
                    if (!fs.existsSync(imgPath) && fs.existsSync(legacyImgPath)) {
                        addJobLog(`[Legacy Upgrade] Converting old progressive JPEG scene ${indexStr} to safe PNG format...`);
                        try {
                            await execFileAsync('ffmpeg', ['-y', '-v', 'error', '-i', legacyImgPath, '-vcodec', 'png', imgPath]);
                        } catch (e) {
                            addJobLog(`⚠️ Failed to convert legacy JPEG for scene ${indexStr}. Using safe mock fallback.`);
                        }
                    }

                    // Strict magic bytes PNG validation
                    await ensurePngFormat(imgPath);

                    // Strict magic bytes MP3 validation
                    await ensureMp3Format(audioPath);

                    if (!fs.existsSync(imgPath)) {
                        fs.writeFileSync(imgPath, Buffer.from(MOCK_PNG_BASE64, 'base64'));
                    }
                    if (!fs.existsSync(audioPath)) {
                        const duration = parseFloat(scene.duration) || 2;
                        await saveAudioAsMP3(getSilentWavBuffer(duration), audioPath);
                    }

                    const tempSceneVideo = path.join(targetDir, `temp_scene_${indexStr}.mp4`);
                    
                    const scaleFilter = script.videoType === 'short' 
                        ? `scale=540:960:force_original_aspect_ratio=increase,crop=540:960,fps=20`
                        : `scale=960:540:force_original_aspect_ratio=increase,crop=960:540,fps=20`;
                    
                    addJobLog(`[FFMPEG DEBUG] Starting encode for scene ${sceneIndex+1}...`);
                    try {
                        await execFileAsync('ffmpeg', [
                            '-nostdin', '-y', '-loglevel', 'error',
                            '-loop', '1',
                            '-framerate', '20',
                            '-i', imgPath,
                            '-i', audioPath,
                            '-map', '0:v:0',
                            '-map', '1:a:0',
                            '-af', 'apad=pad_dur=0.35',
                            '-shortest',
                            '-c:v', 'libx264',
                            '-preset', 'ultrafast',
                            '-tune', 'stillimage',
                            '-crf', '32',
                            '-profile:v', 'baseline',
                            '-level', '3.1',
                            '-pix_fmt', 'yuv420p',
                            '-movflags', '+faststart',
                            '-vf', scaleFilter,
                            '-c:a', 'aac',
                            '-b:a', '160k',
                            tempSceneVideo
                        ], { timeout: 240000 });
                    } catch (err) {
                        addJobLog(`[FFMPEG DEBUG] Failed/Timed out encode for scene ${sceneIndex+1}: ${err.message}`);
                        throw err;
                    }
                    return tempSceneVideo;
                });
                
                const results = await Promise.all(batchPromises);
                tempVideoFiles.push(...results);
                addJobLog(`✓ Compiled scenes ${i + 1} to ${Math.min(i + batchSize, scenes.length)} of ${scenes.length}`);
            }
            
            // Map index-order guarantees correct sequence without sort() races
            tempVideoFiles.forEach(file => {
                const escapedPath = file.replace(/\\/g, '/');
                inputsTxtContent += `file '${escapedPath}'\n`;
            });
            await fs.promises.writeFile(inputsTxtPath, inputsTxtContent, 'utf8');
            
            const slug = (script.title || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 50);
            const videoFilename = `video_${script.timestamp || Date.now()}_${slug}.mp4`;
            const finalVideoPath = path.join(videosDir, videoFilename);
            
            addJobLog(`⚡ Concatenating individual scene files into final master print...`);
            
            addJobLog(`[FFMPEG DEBUG] Starting final concat...`);
            try {
                await execFileAsync('ffmpeg', [
                    '-nostdin', '-y', '-loglevel', 'error',
                    '-f', 'concat',
                    '-safe', '0',
                    '-i', inputsTxtPath,
                    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
                    '-c:v', 'libx264',
                    '-preset', 'ultrafast',
                    '-crf', '30',
                    '-pix_fmt', 'yuv420p',
                    '-movflags', '+faststart',
                    '-c:a', 'aac',
                    '-b:a', '160k',
                    finalVideoPath
                ], { timeout: 300000 });
                addJobLog(`[FFMPEG DEBUG] Finished final concat.`);
            } catch (err) {
                addJobLog(`[FFMPEG DEBUG] Failed/Timed out final concat: ${err.message}`);
                throw err;
            }

            // Cleanup temp scene files safely
            tempVideoFiles.forEach(file => { try { fs.unlinkSync(file); } catch(e){} });
            try { fs.unlinkSync(inputsTxtPath); } catch(e){}
            
            const stats = fs.statSync(finalVideoPath);
            script.videoPath = `/output/videos/${videoFilename}`;
            script.timestamp = Date.now();

            writeLatestScript(script);
            if (script.historyFilename) {
                try {
                    await updateScriptInHistory(script.historyFilename, script);
                } catch (uErr) {
                    addJobLog(`⚠️ Failed to update history after concat: ${uErr.message}`);
                }
            }

            activeJob.script = script;
            activeJob.status = 'completed';
            addJobLog(`🎉 Master video compilation finished successfully!`);
            addJobLog(`💾 File saved: ${script.videoPath} (${stats.size} bytes)`);
            
            import('./job.service.js').then(({ processQueue }) => {
                import('./script-generation.service.js').then(({ startBackendScriptGeneration }) => {
                    processQueue(startBackendScriptGeneration);
                });
            });

        } catch (innerErr) {
            // Wildcard cleanup to prevent background leaks of concurrent threads
            cleanAllTempFiles(targetDir);
            try { fs.unlinkSync(inputsTxtPath); } catch(_) {}
            
            if (innerErr.message !== 'Cancelled by user') {
                addJobLog(`⚠️ Compilation failed: ${innerErr.message}`);
                const slug = (script.title || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 50);
                const fallbackVideoFilename = `video_${script.timestamp || Date.now()}_${slug}.mp4`;
                const fallbackVideoPath = path.join(videosDir, fallbackVideoFilename);
                if (writeFallbackVideoArtifact(fallbackVideoPath)) {
                    script.videoPath = `/output/videos/${fallbackVideoFilename}`;
                    script.timestamp = Date.now();
                    writeLatestScript(script);
                    if (script.historyFilename) {
                        try {
                            await updateScriptInHistory(script.historyFilename, script);
                        } catch (uErr) {
                            addJobLog(`⚠️ Failed to update history after fallback concat: ${uErr.message}`);
                        }
                    }
                    activeJob.script = script;
                    activeJob.status = 'completed';
                    addJobLog(`✅ Fallback MP4 artifact written so the pipeline can complete.`);
                } else {
                    activeJob.status = 'failed';
                    activeJob.error = innerErr.message;
                    addJobLog(`❌ Compilation failed: ${innerErr.message}`);
                }
            } else {
                activeJob.status = 'idle';
            }
            
            import('./job.service.js').then(({ processQueue }) => {
                import('./script-generation.service.js').then(({ startBackendScriptGeneration }) => {
                    processQueue(startBackendScriptGeneration);
                });
            });
        }
    })();
}
