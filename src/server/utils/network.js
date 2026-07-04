import https from 'https';

export function httpsPost(url, headers, body, timeoutMs = 120000) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const options = {
            hostname: u.hostname,
            path: u.pathname + u.search,
            method: 'POST',
            headers: {
                ...headers,
                'Content-Length': Buffer.byteLength(body)
            },
            timeout: timeoutMs
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

        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Request timed out after ${timeoutMs / 1000}s: ${url}`));
        });
        req.on('error', (e) => reject(e));
        req.write(body);
        req.end();
    });
}

export function httpsGet(url, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && maxRedirects > 0) {
                return resolve(httpsGet(res.headers.location, maxRedirects - 1));
            }
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

export async function fetchImageBuffer(imgUrl) {
    if (imgUrl && imgUrl.startsWith('data:')) {
        const base64Data = imgUrl.split(',')[1];
        return Buffer.from(base64Data, 'base64');
    }
    return await httpsGet(imgUrl);
}

// Downloads audio from a data: URI (base64) or a regular HTTPS URL.
// Gemini TTS on Replicate returns data:audio/...;base64,... — not an HTTPS link.
export async function downloadAudioFromUrl(urlOrDataUri) {
    if (typeof urlOrDataUri === 'string' && urlOrDataUri.startsWith('data:')) {
        const commaIdx = urlOrDataUri.indexOf(',');
        if (commaIdx === -1) throw new Error('Invalid data URI: no comma separator');
        return Buffer.from(urlOrDataUri.slice(commaIdx + 1), 'base64');
    }
    return await httpsGet(urlOrDataUri);
}
