// Shared validation utilities used by both the frontend (App.jsx)
// and the backend (script-generation.service.js).
// No Node-specific or browser-specific APIs — pure JS only.

import { BANNED_PRONOUNS } from './constants.js';

/**
 * Validates that an AI image prompt contains no banned stateful words
 * (pronouns, relative references) that would break a stateless image generator.
 *
 * @param {string} promptText
 * @returns {{ isValid: boolean, words: string[] }}
 */
export function validatePromptText(promptText) {
    if (!promptText) return { isValid: true, words: [] };
    const cleaned = promptText.toLowerCase().replace(/[^a-z0-9'\s-]/g, ' ');
    const tokens = cleaned.split(/\s+/);
    const leaked = BANNED_PRONOUNS.filter(p => tokens.includes(p));
    return {
        isValid: leaked.length === 0,
        words: leaked
    };
}

/**
 * Calculates the scene duration in seconds from a spoken word count using the
 * same thresholds enforced in the LLM scriptwriting prompt:
 *   1–4 words  → 2 s
 *   5–7 words  → 3 s
 *   8–10 words → 4 s
 *   >10 words  → 4 s (capped; over-long scenes should have been split already)
 *
 * @param {number} wordCount
 * @returns {number} duration in seconds
 */
export function calcDurationFromWordCount(wordCount) {
    if (wordCount <= 4) return 2;
    if (wordCount <= 7) return 3;
    return 4;
}
