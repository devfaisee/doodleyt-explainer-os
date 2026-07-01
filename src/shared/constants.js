// Shared constants used by both the frontend (App.jsx, pipelineStore.js)
// and the backend (script-generation.service.js).
// No Node-specific or browser-specific APIs — pure JS only.

export const DEFAULT_TOPICS = [
    { id: 1, title: "Your Teeth Weren't Meant For Modern Food", cat: "Evolutionary Anthropology", curiosity: 9.8, novelty: 9.6, relatability: 9.4, hook: "Why ancient human skulls show perfect straight teeth and zero wisdom teeth impactions before agriculture." },
    { id: 2, title: "Why Complete Silence Terrifies the Human Brain", cat: "Behavioral Psychology", curiosity: 9.9, novelty: 9.7, relatability: 9.2, hook: "Inside the world's quietest room, the silence is so absolute that you start hearing your own organs grinding." },
    { id: 3, title: "Why Left-Handed Spies Were Banned in the 1960s", cat: "Biological Anomalies", curiosity: 9.8, novelty: 9.8, relatability: 8.8, hook: "How an obscure biological trait became an instant automatic dealbreaker for Cold War spy agencies." },
    { id: 4, title: "Before Fire, Every Night Was a Nightmare", cat: "Existential Mysteries", curiosity: 9.7, novelty: 9.5, relatability: 9.0, hook: "How the discovery of fire saved early humans from the terrifying nocturnal predators that ruled the prehistoric dark." },
    { id: 5, title: "Why Ancient Builders Buried Gobekli Tepe Under Dirt", cat: "Archaeological Mysteries", curiosity: 9.8, novelty: 9.6, relatability: 8.5, hook: "Why the world's oldest temple was deliberately buried under thousands of tons of soil by its own creators." },
    { id: 6, title: "The Primal Switch That Flips When You Get Lost", cat: "Survival Psychology", curiosity: 9.6, novelty: 9.4, relatability: 8.9, hook: "Why lost hikers walk in perfect circles, even when they are convinced they are walking straight." },
    { id: 7, title: "The Town That Danced Themselves to Death in 1518", cat: "Mass Hysteria", curiosity: 9.9, novelty: 9.8, relatability: 8.7, hook: "What happens when a mass psychological outbreak causes an entire city to dance uncontrollably until their hearts fail." },
    { id: 8, title: "The 1-Character Code Typo That Wiped Out $500M", cat: "Technological Blunders", curiosity: 9.8, novelty: 9.7, relatability: 9.0, hook: "How a junior developer forgot a reentrancy guard, draining a massive decentralized vault in less than a minute." },
    { id: 9, title: "The Wow Signal and the Fermi Paradox", cat: "Cosmic Anomalies", curiosity: 9.9, novelty: 9.8, relatability: 8.4, hook: "What scientists actually discovered when they analyzed the deep space radio signal that broke cosmic silence." },
    { id: 10, title: "The Medieval Trials Where Rats Were Put on Trial", cat: "Psychology of Beliefs", curiosity: 9.7, novelty: 9.8, relatability: 8.6, hook: "How medieval courts legally prosecuted, tried, and executed weasels, pigs, and insects for crimes." }
];

export const DEFAULT_VISUAL_DNA = "Minimalist hand-drawn 2D vector-style cartoon illustration (similar to YouTube channel Zenn). Clean, smooth, non-jagged black felt-pen outlines and solid flat color fills. Exaggerated comical cartoon expressions (wide cartoon eyes, sweating, gaping mouth). Backgrounds are high-contrast and completely flat: solid white, bright solid yellow, deep solid black, or simple flat colored environments (no gradients, no realistic shading, no 3D rendering). Features bold, hand-drawn uppercase text overlays with thick black outlines (typically in bright yellow, red, or white) and clean, hand-drawn red pointing arrows or white speech bubbles where appropriate. Simple, clean, cute cartoon representations of characters, animals, and objects instead of complex or messy sketches. Perfect clean outlines (no messy or pixelated lines, no scribbled draft lines).";

export const DEFAULT_STYLE_REFS = ['18154.jpg', '18153.jpg', '18152.jpg', '18142.jpg', '18146.jpg', '18143.jpg', '18147.jpg', '18151.jpg', '18149.jpg', '18159.jpg'];

// Words whose presence in an AI image prompt indicates a stateful/pronoun reference
// that will break the stateless image generator. Keep this list in sync with the
// LLM system prompt in script-generation.service.js.
export const BANNED_PRONOUNS = [
    'he', 'she', 'it', 'they', 'his', 'her', 'their', 'its',
    'same', 'similar', 'previous', 'earlier', 'above', 'below',
    'again', 'identical', 'character', 'figure'
];

// LLM cost rates in USD per 1 million tokens: { input, output }.
// Add new models here as they become available.
export const MODEL_RATES = {
    'deepseek/deepseek-v4-flash':      { input: 0.09,  output: 0.18  },
    'deepseek/deepseek-v3':            { input: 0.27,  output: 1.10  },
    'deepseek/deepseek-r1':            { input: 0.55,  output: 2.19  },
    'deepseek/deepseek-r1-0528':       { input: 0.55,  output: 2.19  },
    'anthropic/claude-3.5-sonnet':     { input: 3.0,   output: 15.0  },
    'anthropic/claude-3.7-sonnet':     { input: 3.0,   output: 15.0  },
    'anthropic/claude-opus-4':         { input: 15.0,  output: 75.0  },
    'openai/gpt-4o':                   { input: 2.5,   output: 10.0  },
    'openai/gpt-4o-mini':              { input: 0.15,  output: 0.60  },
    'openai/gpt-4.1':                  { input: 2.0,   output: 8.0   },
    'openai/gpt-4.1-mini':             { input: 0.40,  output: 1.60  },
    'google/gemini-2.5-flash':         { input: 0.30,  output: 2.50  },
    'google/gemini-2.5-pro':           { input: 1.25,  output: 10.0  },
    'meta-llama/llama-3.3-70b-instruct': { input: 0.59, output: 0.79 },
};

// Default fallback rate for unknown models — conservative mid-tier estimate.
export const DEFAULT_MODEL_RATE = { input: 0.5, output: 1.5 };
