import fs from 'fs';
import path from 'path';
import { activeJob, jobQueue, addJobLog, writeLatestScript } from './job.service.js';
import { callReplicateWithRetry, extractSpokenText, MOCK_PNG_BASE64 } from './media.service.js';
import { updateScriptInHistory } from './history.service.js';
import { getAudioFileName, saveAudioAsMP3, getSilentWavBuffer } from './ffmpeg.service.js';
import { ensureDir } from '../utils/fileSystem.js';
import { readConfig } from '../utils/config.js';
import { fetchImageBuffer, httpsGet } from '../utils/network.js';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const probeAudioDurationSeconds = async (audioPath) => {
    try {
        const { stdout } = await execFileAsync('ffprobe', [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            audioPath
        ]);
        const duration = Number.parseFloat(stdout.trim());
        if (!Number.isFinite(duration) || duration <= 0.05) return null;
        return duration;
    } catch (_) {
        return null;
    }
};

const compactSpeechAudio = async (audioPath) => {
    const compactPath = `${audioPath}.compact.mp3`;
    try {
        const beforeDuration = await probeAudioDurationSeconds(audioPath);
        await execFileAsync('ffmpeg', [
            '-nostdin',
            '-y',
            '-v', 'error',
            '-i', audioPath,
            '-af', 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12:stop_periods=-1:stop_threshold=-45dB:stop_silence=0.45',
            '-c:a', 'libmp3lame',
            '-q:a', '3',
            compactPath
        ]);
        const afterDuration = await probeAudioDurationSeconds(compactPath);
        if (afterDuration && (!beforeDuration || afterDuration >= 0.35)) {
            await fs.promises.rename(compactPath, audioPath);
            return { beforeDuration, afterDuration };
        }
    } catch (_) {
        // Keep original file when compaction fails.
    } finally {
        try { fs.unlinkSync(compactPath); } catch (_) {}
    }
    return null;
};

export function startBackendSynthesis(script, falApiKey, elevenlabsApiKey, providedOutputPath, providedOpenRouterApiKey, providedGeminiApiKey, synthesisMode = 'audio_and_images') {
    activeJob.status = 'running';
    activeJob.jobType = 'synthesis';
    activeJob.logs = [];
    activeJob.error = null;
    activeJob.script = script;
    activeJob.stages = [];
    
    (async () => {
        const audioOnly = synthesisMode === 'audio_only';
        addJobLog(`⚡ Starting background ${audioOnly ? 'VOICE-ONLY' : 'full media'} synthesis for script: "${script.title}"`);
        if (audioOnly) addJobLog(`🎙️ Mode: Audio Only — skipping image generation entirely.`);
        try {
            const config = readConfig();
            const geminiApiKey = providedGeminiApiKey || config.geminiApiKey || '';
            const targetDir = providedOutputPath || config.outputPath || path.join(process.cwd(), 'output');
            const imagesDir = path.join(targetDir, 'images');
            const audioDir = path.join(targetDir, 'audio');
            const thumbnailsDir = path.join(targetDir, 'thumbnails');
            
            ensureDir(targetDir);
            ensureDir(imagesDir);
            ensureDir(audioDir);
            ensureDir(thumbnailsDir);
            
            const scenes = script.scenes || [];
            addJobLog(`⚙️ Synthesizing media for ${scenes.length} scenes...`);
            
            let thumbnailPath = '';
            if (script.thumbnail && !audioOnly) {
                let thumbBuffer = null;
                let thumbGenerated = false;

                if (true) {
                    addJobLog(`🎨 [Replicate] Synthesizing custom thumbnail image...`);
                    try {
                        const replicateApiKey = process.env.REPLICATE_API_KEY || falApiKey;
                        const payload = JSON.stringify({
                            input: {
                                prompt: script.thumbnail,
                                aspect_ratio: script.videoType === 'short' ? '9:16' : '16:9',
                                output_format: "png"
                            }
                        });
                        const imgUrl = await callReplicateWithRetry(payload, replicateApiKey, addJobLog);
                        thumbBuffer = await fetchImageBuffer(imgUrl);
                        thumbGenerated = true;
                        addJobLog(`✓ [Replicate] Custom thumbnail image completed.`);
                    } catch (err) {
                        addJobLog(`⚠️ [Replicate] Thumbnail synthesis failed: ${err.message}`);
                    }
                }

                if (thumbGenerated && thumbBuffer) {
                    try {
                        const slug = (script.title || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 50);
                        const thumbName = `thumb_${script.timestamp || Date.now()}_${slug}.png`;
                        const fullThumbPath = path.join(thumbnailsDir, thumbName);
                        
                        await fs.promises.writeFile(fullThumbPath, thumbBuffer);
                        thumbnailPath = `/output/thumbnails/${thumbName}`;
                        addJobLog(`✓ Custom thumbnail saved: ${thumbnailPath}`);
                    } catch (saveErr) {
                        addJobLog(`⚠️ Failed to save thumbnail file: ${saveErr.message}`);
                    }
                }
            }
            
            for (let i = 0; i < scenes.length; i++) {
                if (activeJob.status === 'idle') {
                    addJobLog(`🛑 Synthesis job cancelled by user.`);
                    return;
                }
                
                const scene = scenes[i];
                const indexStr = (i + 1).toString().padStart(3, '0');
                const imgPath = path.join(imagesDir, `scene_${indexStr}.png`);
                const audioFileName = getAudioFileName(script.title, i);
                const audioPath = path.join(audioDir, audioFileName);
                
                scene.imagePath = `/output/images/scene_${indexStr}.png`;
                scene.audioPath = `/output/audio/${audioFileName}`;
                
                if (!audioOnly) {
                    let imgBuffer = null;
                    let imgGenerated = false;

                    if (true) {
                        try {
                            addJobLog(`[Replicate] Scene ${i+1}/${scenes.length} generating image...`);
                            const replicateApiKey = process.env.REPLICATE_API_KEY || falApiKey;
                            const payload = JSON.stringify({
                                input: {
                                    prompt: scene.prompt,
                                    aspect_ratio: script.videoType === 'short' ? '9:16' : '16:9',
                                    output_format: "png"
                                }
                            });
                            const imgUrl = await callReplicateWithRetry(payload, replicateApiKey, addJobLog);
                            imgBuffer = await fetchImageBuffer(imgUrl);
                            imgGenerated = true;
                            addJobLog(`✓ [Replicate] Scene ${i+1}/${scenes.length} image completed.`);
                        } catch (err) {
                            addJobLog(`⚠️ [Replicate] failed for scene ${i+1}: ${err.message}. Saving fallback.`);
                        }
                    }

                    if (imgGenerated && imgBuffer) {
                        await fs.promises.writeFile(imgPath, imgBuffer);
                    } else {
                        addJobLog(`ℹ️ Saving mock canvas image for scene ${i+1}`);
                        await fs.promises.writeFile(imgPath, Buffer.from(MOCK_PNG_BASE64, 'base64'));
                    }
                }
                
                const replicateApiKey = process.env.REPLICATE_API_KEY || (readConfig().replicateApiKey) || falApiKey;
                const spokenText = extractSpokenText(scene.voiceover);
                let audioGenerated = false;

                if (replicateApiKey && replicateApiKey.trim().length > 10 && spokenText) {
                    try {
                        addJobLog(`[Chatterbox TTS] Scene ${i+1}/${scenes.length} generating voiceover...`);
                        const payload = JSON.stringify({
                            input: {
                                text: spokenText,
                                voice: "Andy",
                                temperature: 0.3
                            }
                        });
                        const audioUrl = await callReplicateWithRetry(
                            payload, 
                            replicateApiKey.trim(), 
                            addJobLog, 
                            "https://api.replicate.com/v1/models/resemble-ai/chatterbox-turbo/predictions"
                        );
                        const audioBuffer = await httpsGet(audioUrl);
                        await fs.promises.writeFile(audioPath, audioBuffer);
                        addJobLog(`✓ [Chatterbox TTS] Scene ${i+1}/${scenes.length} voiceover saved as ${audioFileName}.`);
                        audioGenerated = true;
                    } catch (cbErr) {
                        addJobLog(`⚠️ Chatterbox TTS failed for scene ${i+1}: ${cbErr.message}. Saving silent fallback.`);
                    }
                }

                if (!audioGenerated) {
                    const duration = parseFloat(scene.duration) || 2;
                    await saveAudioAsMP3(getSilentWavBuffer(duration), audioPath);
                    if (!spokenText) {
                        addJobLog(`ℹ️ Scene ${i+1} has no spoken text. Saved silent block.`);
                    } else {
                        addJobLog(`ℹ️ Saved silent fallback for Scene ${i+1} due to API failures.`);
                    }
                }

                if (audioGenerated && spokenText) {
                    const compactResult = await compactSpeechAudio(audioPath);
                    if (compactResult && compactResult.beforeDuration && compactResult.afterDuration && compactResult.afterDuration < compactResult.beforeDuration - 0.2) {
                        addJobLog(`✂️ Trimmed long TTS pauses in Scene ${i + 1} (${compactResult.beforeDuration.toFixed(2)}s → ${compactResult.afterDuration.toFixed(2)}s).`);
                    }
                }

                const measuredDuration = await probeAudioDurationSeconds(audioPath);
                if (measuredDuration) {
                    scene.exactAudioDuration = Number(measuredDuration.toFixed(3));
                    scene.duration = Math.max(2, Math.ceil(measuredDuration));
                }
            }
            
            script.assetsSynthesized = true;
            if (thumbnailPath) script.thumbnailPath = thumbnailPath;
            script.timestamp = Date.now();
            
            const costPerImage = 0.003;
            const costPerAudio = 0.004;
            const baseLLMCost = script.estimatedCost ? (script.estimatedCost.llm || 0.002) : 0.002;
            const numScenes = scenes.length;
            
            script.estimatedCost = {
                images: Number((numScenes * costPerImage).toFixed(4)),
                audio: Number((numScenes * costPerAudio).toFixed(4)),
                llm: baseLLMCost,
                total: Number(((numScenes * costPerImage) + (numScenes * costPerAudio) + baseLLMCost).toFixed(4))
            };
            addJobLog(`💰 Estimated API Cost for this video: $${script.estimatedCost.total.toFixed(4)} (${numScenes} scenes × $0.003 img + $0.004 audio + $${baseLLMCost} LLM)`);
            
            writeLatestScript(script);
            if (script.historyFilename) {
                await updateScriptInHistory(script.historyFilename, script);
            }
            
            activeJob.script = script;
            if (jobQueue.length > 0) {
                addJobLog(`⚡ Bulk queue detected. Bypassing storyboard and auto-assembling...`);
                import('./assembly.service.js').then(({ startBackendAssembly }) => {
                    startBackendAssembly(script, null);
                });
            } else {
                activeJob.status = 'synthesis_complete';
                addJobLog(`🎉 Asset synthesis finished successfully! Waiting for manual assembly...`);
                import('./job.service.js').then(({ processQueue }) => {
                    import('./script-generation.service.js').then(({ startBackendScriptGeneration }) => {
                        processQueue(startBackendScriptGeneration);
                    });
                });
            }
        } catch (e) {
            activeJob.status = 'failed';
            activeJob.error = e.message;
            addJobLog(`❌ Asset synthesis failed: ${e.message}`);
            import('./job.service.js').then(({ processQueue }) => {
                import('./script-generation.service.js').then(({ startBackendScriptGeneration }) => {
                    processQueue(startBackendScriptGeneration);
                });
            });
        }
    })();
}
