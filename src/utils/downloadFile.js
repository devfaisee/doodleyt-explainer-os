import { apiFetch, getAssetUrl } from '../apiClient.js';

export async function downloadFile(urlPath, filename) {
    try {
        const response = await apiFetch(urlPath);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    } catch (err) {
        console.warn('Secure download failed, falling back to public link:', err);
        // Fallback to direct opening if apiFetch fails or isn't needed
        window.open(getAssetUrl(urlPath), '_blank');
    }
}
