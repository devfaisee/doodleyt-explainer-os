import { spawn } from 'child_process';
import fs from 'fs';

export function pcmToWav(pcmBuffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16) {
    const buffer = Buffer.alloc(44 + pcmBuffer.length);
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + pcmBuffer.length, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE((sampleRate * numChannels * bitsPerSample) / 8, 28);
    buffer.writeUInt16LE((numChannels * bitsPerSample) / 8, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(pcmBuffer.length, 40);
    pcmBuffer.copy(buffer, 44);
    return buffer;
}

export function getSilentWavBuffer(durationSeconds = 2) {
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

export function getAudioFileName(title, sceneIndex) {
    const words = (title || 'audio scene')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 0)
        .slice(0, 2);
    const prefix = words.length > 0 ? words.join('-') : 'audio';
    const padded = String(sceneIndex + 1).padStart(2, '0');
    return `${prefix}-voiceover-${padded}.mp3`;
}

export function saveAudioAsMP3(inputBuffer, destPath) {
    // Write to a neutral .bin temp file — ffmpeg auto-detects format.
    // Handles WAV, MP3, OGG, FLAC, or any format Replicate TTS APIs return.
    return new Promise((resolve, reject) => {
        const tempInput = destPath.replace(/\.mp3$/, '_tmp.bin');
        fs.writeFile(tempInput, inputBuffer, (writeErr) => {
            if (writeErr) return reject(writeErr);
            
            // No -f flag: ffmpeg probes and detects format automatically
            const ffmpeg = spawn('ffmpeg', [
                '-nostdin',
                '-y',
                '-i', tempInput,
                '-codec:a', 'libmp3lame',
                '-qscale:a', '2',
                destPath
            ]);
            
            let stderr = '';
            ffmpeg.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            ffmpeg.on('close', (code) => {
                try { fs.unlinkSync(tempInput); } catch (_) {}
                if (code !== 0) {
                    return reject(new Error(`FFmpeg MP3 conversion failed with code ${code}. Stderr: ${stderr}`));
                }
                resolve();
            });
            
            ffmpeg.on('error', (err) => {
                try { fs.unlinkSync(tempInput); } catch (_) {}
                reject(err);
            });
        });
    });
}
