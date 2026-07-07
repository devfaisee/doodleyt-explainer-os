import React from 'react';

export default function SettingsView({
    apiKey,
    setApiKey,
    geminiApiKey,
    setGeminiApiKey,
    falApiKey,
    setFalApiKey,
    elevenlabsApiKey,
    setElevenlabsApiKey,
    model,
    setModel,
    outputPath,
    setOutputPath,
    visualDNA,
    setVisualDNA,
    styleReferences,
    setStyleReferences,
    characters,
    saveConfig
}) {
    return (
        <div className="space-y-6 max-w-3xl">
            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl shadow-lg space-y-6">
                <h2 className="text-xl font-bold text-white mb-1">Global Pipeline Configuration</h2>
                
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-mono text-neutral-400 block mb-1.5 font-semibold">OpenRouter API Key (For DeepSeek LLM)</label>
                        <input 
                            type="password" 
                            placeholder="sk-or-v1-..."
                            className="w-full bg-neutral-950 border border-neutral-850 focus:border-blue-500 p-3.5 rounded-xl text-neutral-200 outline-none font-mono text-sm"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="text-xs font-mono text-neutral-400 block mb-1.5 font-semibold">Replicate API Key (For Flux Images & Chatterbox Voiceover)</label>
                        <input 
                            type="password" 
                            placeholder="r8_..."
                            className="w-full bg-neutral-950 border border-neutral-850 focus:border-blue-500 p-3.5 rounded-xl text-neutral-200 outline-none font-mono text-sm"
                            value={falApiKey}
                            onChange={(e) => setFalApiKey(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="text-xs font-mono text-neutral-400 block mb-1.5 font-semibold">Pipeline Orchestrator Model</label>
                        <div className="flex gap-2">
                            <select 
                                className="flex-1 bg-neutral-950 border border-neutral-855 focus:border-blue-500 p-3.5 rounded-xl text-neutral-200 outline-none font-mono text-sm"
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                            >
                                <option value="deepseek/deepseek-v4-flash">DeepSeek V4 Flash (QC & Analytical)</option>
                                <option value="anthropic/claude-sonnet-5">Claude Sonnet 5 (Ideation & Hooks)</option>
                                <option value="z-ai/glm-5.2">GLM 5.2 (Script Drafting & Pacing)</option>
                                <option value="stepfun/step-3.7-flash">Step 3.7 Flash (SEO & Tags)</option>
                            </select>
                            <input 
                                type="text" 
                                placeholder="Custom model..."
                                className="bg-neutral-950 border border-neutral-850 focus:border-blue-500 p-3.5 rounded-xl text-neutral-200 outline-none font-mono text-sm w-1/3"
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-mono text-neutral-400 block mb-1.5 font-semibold">Visual DNA Guidelines String</label>
                        <textarea 
                            rows="3"
                            className="w-full bg-neutral-950 border border-neutral-850 focus:border-blue-500 p-3.5 rounded-xl text-neutral-200 outline-none font-mono text-sm resize-none"
                            value={visualDNA}
                            onChange={(e) => setVisualDNA(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="text-xs font-mono text-neutral-400 block mb-1.5 font-semibold">Style Reference Codes (Comma-separated)</label>
                        <input 
                            type="text" 
                            placeholder="18154.jpg, 18153.jpg, ..."
                            className="w-full bg-neutral-950 border border-neutral-850 focus:border-blue-500 p-3.5 rounded-xl text-neutral-200 outline-none font-mono text-sm"
                            value={Array.isArray(styleReferences) ? styleReferences.join(', ') : styleReferences}
                            onChange={(e) => setStyleReferences(e.target.value.split(',').map(s => s.trim()))}
                        />
                    </div>
                </div>

                <div className="pt-4 border-t border-neutral-800 flex justify-end">
                    <button 
                        onClick={() => {
                            saveConfig({ apiKey, geminiApiKey, falApiKey, elevenlabsApiKey, model, outputPath, characters, visualDNA, styleReferences });
                            alert('Settings locked successfully!');
                        }}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition"
                    >
                        Save Config Properties
                    </button>
                </div>
            </div>
        </div>
    );
}
