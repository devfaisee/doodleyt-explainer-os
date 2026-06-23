import React, { useState } from 'react';

export default function QCView({
    BANNED_PRONOUNS,
    validatePromptText
}) {
    const [qcTestText, setQcTestText] = useState('');

    const validation = validatePromptText(qcTestText);

    return (
        <div className="space-y-6 max-w-5xl animate-fadeIn">
            {/* Header Banner */}
            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-3xl pointer-events-none"></div>
                <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                    <span>🛡️</span> QC & Stateless Guardrails
                </h2>
                <p className="text-sm text-neutral-400 font-medium">Dynamically shields image prompts from context memory failure by banning and stripping relative reference words.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Side: Absolute Ban List */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl shadow-lg space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xs uppercase tracking-widest font-mono text-neutral-400 font-semibold">Absolute Banned Word Signatures</h3>
                            <span className="bg-red-900/30 text-red-400 border border-red-800/30 text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase">Enforced</span>
                        </div>
                        <p className="text-xs text-neutral-400">If any of these pronouns or relative references leak into a visual prompt, the image generator will fail to compile the character correctly. Our guardrail system catches and flags them immediately.</p>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {BANNED_PRONOUNS.map((word) => (
                                <div key={word} className="bg-neutral-950 border border-neutral-850/80 p-3 rounded-xl flex flex-col justify-between hover:border-red-500/20 transition-all font-mono">
                                    <span className="text-red-400 text-xs font-bold font-mono">"{word}"</span>
                                    <span className="text-[9px] text-neutral-600 uppercase mt-1">Blocked Pattern</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Live QC Playground */}
                    <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl shadow-lg space-y-4">
                        <h3 className="text-xs uppercase tracking-widest font-mono text-neutral-400 font-semibold">Interactive Playground: Prompt Sanitizer</h3>
                        <p className="text-xs text-neutral-400">Type or paste a draft visual prompt below to test if it violates the stateless design rule.</p>
                        
                        <div className="space-y-4">
                            <textarea 
                                value={qcTestText}
                                onChange={(e) => setQcTestText(e.target.value)}
                                placeholder="e.g. A crude stickman doodle of Bob holding a pen. He is smiling while he looks at the camera again..."
                                rows="3"
                                className="w-full bg-neutral-950 border border-neutral-800 focus:border-red-500 focus:ring-1 focus:ring-red-500/20 p-4 rounded-2xl text-sm text-neutral-200 outline-none font-mono resize-none transition-all"
                            />
                            
                            {qcTestText && (
                                <div className={`p-4 rounded-2xl border ${validation.isValid ? 'bg-green-950/10 border-green-500/20 text-green-400' : 'bg-red-950/10 border-red-500/20 text-red-400'} font-mono text-xs space-y-2`}>
                                    <div className="flex items-center gap-2 font-bold uppercase tracking-wider">
                                        <span>{validation.isValid ? '✓ Shield Intact' : '⚠ Violation Caught'}</span>
                                    </div>
                                    <p className="text-neutral-400 font-sans">
                                        {validation.isValid 
                                            ? 'This prompt does not contain any relative pronouns or memory state words. It is safe for stateless generation!'
                                            : `Banned terms detected: ${validation.words.map(w => `"${w}"`).join(', ')}. Please replace them with absolute descriptions.`
                                        }
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Side: Technical Specs */}
                <div className="space-y-6">
                    <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl shadow-lg space-y-4">
                        <h3 className="text-xs uppercase tracking-widest font-mono text-neutral-400 font-semibold">Why is this critical?</h3>
                        <div className="text-xs text-neutral-400 space-y-3 leading-relaxed">
                            <p><strong>Memoryless Generators:</strong> Image generators process each image in total isolation. They do not know what was generated in previous scenes.</p>
                            <p><strong>The Pronoun Trap:</strong> Saying <em>"He is walking"</em> makes the generator hallucinate a random new character. The name <em>"Bob"</em> alone is not enough either, as "Bob" means nothing to the base model.</p>
                            <p><strong>The Solution:</strong> The orchestrator automatically parses every character's description card and injects it in place of pronouns. The word <em>"He"</em> is forbidden; instead, we must say: <em>"A crude stickman with red baseball cap and blue hoodie"</em>.</p>
                        </div>
                    </div>

                    <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl shadow-lg space-y-4">
                        <h3 className="text-xs uppercase tracking-widest font-mono text-neutral-400 font-semibold">Guardrail Metrics</h3>
                        <div className="space-y-3 font-mono text-xs">
                            <div className="flex justify-between py-1 border-b border-neutral-800/60">
                                <span className="text-neutral-500">Scan Level:</span>
                                <span className="text-white font-bold">Regex Token Match</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-neutral-800/60">
                                <span className="text-neutral-500">Failure Action:</span>
                                <span className="text-red-400 font-bold">Block & Regenerate</span>
                            </div>
                            <div className="flex justify-between py-1">
                                <span className="text-neutral-500">Active Ruleset:</span>
                                <span className="text-blue-400 font-bold">Doodle Theory v1.2</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
