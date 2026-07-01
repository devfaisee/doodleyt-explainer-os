const envBaseUrl = (import.meta.env.VITE_API_SERVER_URL || '').trim().replace(/\/+$/, '');
export const API_SERVER_URL = envBaseUrl || 'https://node-app-production-d022.up.railway.app';

export const apiFetch = (url, options = {}) => {
    const baseUrl = API_SERVER_URL;
    const targetUrl = url.startsWith('/') ? url : `/${url}`;
    
    // Inject the x-api-key header so the backend authorization passes
    const token = localStorage.getItem('doodleyt_api_key') || '';
    if (!options.headers) {
        options.headers = {};
    }
    options.headers['x-api-key'] = token;

    return fetch(`${baseUrl}${targetUrl}`, options);
};

export const getAssetUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const baseUrl = API_SERVER_URL;
    const targetUrl = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${targetUrl}`;
};
