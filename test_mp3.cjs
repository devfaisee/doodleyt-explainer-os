const fs = require('fs');
const { exec } = require('child_process');

// Add winget FFmpeg to PATH dynamically if it exists (like server.cjs does)
try {
    const wingetFfmpegBin = 'C:\\Users\\6thGen-Lenovo\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin';
    if (fs.existsSync(wingetFfmpegBin)) {
        process.env.PATH = wingetFfmpegBin + ';' + process.env.PATH;
        console.log('[System] Dynamically prepended winget FFmpeg to process.env.PATH');
    }
} catch (e) { }

function saveAudioAsMP3(wavBuffer, destPath) {
    return new Promise((resolve, reject) => {
        const tempWav = destPath.replace(/\.mp3$/, '_tmp.wav');
        fs.writeFile(tempWav, wavBuffer, (writeErr) => {
            if (writeErr) return reject(writeErr);
            const cmd = `ffmpeg -nostdin -y -i "${tempWav}" -codec:a libmp3lame -qscale:a 2 "${destPath}"`;
            exec(cmd, (ffErr, stdout, stderr) => {
                console.log('FFmpeg stdout:', stdout);
                console.log('FFmpeg stderr:', stderr);
                try { fs.unlinkSync(tempWav); } catch (_) {}
                if (ffErr) return reject(new Error(`FFmpeg MP3 conversion failed: ${ffErr.message}`));
                resolve();
            });
        });
    });
}

async function test() {
    try {
        console.log('Testing saveAudioAsMP3...');
        const buffer = Buffer.alloc(44);
        buffer.write('RIFF', 0);
        buffer.writeUInt32LE(36, 4);
        buffer.write('WAVE', 8);
        buffer.write('fmt ', 12);
        buffer.writeUInt32LE(16, 16);
        buffer.writeUInt16LE(1, 20); // PCM
        buffer.writeUInt16LE(1, 22); // Mono
        buffer.writeUInt32LE(24000, 24); // 24kHz
        buffer.writeUInt32LE(24000 * 2, 28);
        buffer.writeUInt16LE(2, 32);
        buffer.writeUInt16LE(16, 34); // 16-bit
        buffer.write('data', 36);
        buffer.writeUInt32LE(0, 40);

        await saveAudioAsMP3(buffer, 'test_output.mp3');
        console.log('Success! test_output.mp3 created.');
        console.log('File exists:', fs.existsSync('test_output.mp3'));
    } catch(e) {
        console.error('Failed:', e);
    }
}
test();
