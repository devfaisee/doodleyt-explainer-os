import React from 'react';

export default function VisualDNAView({
    visualDNA,
    setVisualDNA,
    styleReferences,
    saveConfig
}) {
    return (
        <div className="space-y-6 max-w-5xl animate-fadeIn">
            {/* Header Banner */}
            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
                <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                    <span>🎨</span> Visual DNA Registry
                </h2>
                <p className="text-sm text-neutral-400 font-medium">Global visual parameters and style reference guides locked into the generative core system by the Doodle Theory Constitution.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Side: Style Anchor DNA */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl shadow-lg space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xs uppercase tracking-widest font-mono text-neutral-400 font-semibold">Style DNA Anchor String</h3>
                            <span className="bg-blue-900/30 text-blue-400 border border-blue-800/30 text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase">Editable</span>
                        </div>
                        <p className="text-xs text-neutral-400">This prefix string is appended to every single visual scene prompt prior to image synthesis, forcing Stable Diffusion / Flux seeds to stay strictly on-brand.</p>
                        <textarea 
                            value={visualDNA}
                            onChange={(e) => setVisualDNA(e.target.value)}
                            rows="4"
                            className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-4 rounded-2xl text-sm font-mono text-neutral-300 leading-relaxed outline-none resize-none"
                        />
                        <div className="flex justify-end">
                            <button 
                                onClick={() => {
                                    saveConfig({ visualDNA });
                                    alert('Visual DNA Guidelines updated successfully!');
                                }}
                                className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition"
                            >
                                Apply Guidelines
                            </button>
                        </div>
                    </div>

                    {/* Linked System Assets */}
                    <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl shadow-lg space-y-4">
                        <h3 className="text-xs uppercase tracking-widest font-mono text-neutral-400 font-semibold">Style Reference Tags</h3>
                        <p className="text-xs text-neutral-400">These identifiers are injected into prompt seeds to trigger stickman style checkpoints. Edit in Settings.</p>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {styleReferences.map((ref, idx) => (
                                <div key={ref + idx} className="bg-neutral-950 border border-neutral-855 p-4 rounded-2xl flex items-center justify-between hover:border-blue-500/30 transition-all group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-lg font-bold group-hover:scale-105 transition-transform">
                                            🏷️
                                        </div>
                                        <div>
                                            <div className="text-sm font-mono font-bold text-white">{ref}</div>
                                            <div className="text-[10px] text-neutral-500 font-mono">Reference #{idx + 1}</div>
                                        </div>
                                    </div>
                                    <span className="bg-green-950/20 text-green-400 border border-green-900/30 text-[9px] font-mono px-2 py-0.5 rounded uppercase font-bold">Active</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Side: Visual Constraints Overview */}
                <div className="space-y-6">
                    <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl shadow-lg space-y-4">
                        <h3 className="text-xs uppercase tracking-widest font-mono text-neutral-400 font-semibold">Style Rule Checks</h3>
                        <div className="space-y-3.5">
                            <div className="flex gap-3">
                                <span className="text-green-400 mt-0.5">✓</span>
                                <div>
                                    <h4 className="text-xs font-bold text-neutral-200 font-mono">Solid White Backgrounds</h4>
                                    <p className="text-[11px] text-neutral-400 mt-0.5">Ensures crisp rendering and high contrast against black outlines.</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <span className="text-green-400 mt-0.5">✓</span>
                                <div>
                                    <h4 className="text-xs font-bold text-neutral-200 font-mono">Thin Black Outlines</h4>
                                    <p className="text-[11px] text-neutral-400 mt-0.5">Mimics the classic default whiteboard marker drawing aesthetic.</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <span className="text-green-400 mt-0.5">✓</span>
                                <div>
                                    <h4 className="text-xs font-bold text-neutral-200 font-mono">Flat Colors Only</h4>
                                    <p className="text-[11px] text-neutral-400 mt-0.5">Strictly prohibits gradients, shadows, lighting, or 3D textures.</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <span className="text-green-400 mt-0.5">✓</span>
                                <div>
                                    <h4 className="text-xs font-bold text-neutral-200 font-mono">Extreme Cartoon Expressions</h4>
                                    <p className="text-[11px] text-neutral-400 mt-0.5">Exaggerated mouths, sweat drops, and popping eyes represent the core humor.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
