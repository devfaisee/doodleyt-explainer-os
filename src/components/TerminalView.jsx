import React from 'react';

export default function TerminalView({
    customNicheInput,
    setCustomNicheInput,
    selectedTopic,
    videoType,
    setVideoType,
    targetDuration,
    setTargetDuration,
    pipelineStages,
    isGenerating,
    runScriptGeneration,
    cancelScriptGeneration,
    pipelineLogs,
    logEndRef,
    currentScript,
    copyEntireScriptToClipboard,
    setActiveTab,
    synthesisStatus,
    compileStatus,
    runAssetSynthesis,
    runVideoCompilation,
    copiedField,
    copyToClipboard,
    getAssetUrl
}) {
    return (
        <div className="space-y-6 max-w-5xl">
            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl shadow-lg space-y-4">
                <div>
                    <h2 className="text-xl font-bold text-white mb-1">Autonomous Multistage Terminal</h2>
                    <p className="text-sm text-neutral-400 font-medium">Clicking <strong>Launch Production Blueprint</strong> starts an automated background orchestrator. It executes sequential LLM calls to write a complete, dynamically-paced script in acts without lazy truncations or identical copy-pasted prompts.</p>
                </div>
                
                <div className="space-y-3">
                    <label className="text-xs font-semibold text-neutral-400 block font-mono">Niche Theme or Topic Keyword (Optional)</label>
                    <input 
                        type="text"
                        placeholder="e.g. Banned left handed spies, weird medieval trials, or leave blank for autonomous niche..."
                        className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-4 rounded-xl text-sm text-neutral-200 outline-none font-mono"
                        value={customNicheInput}
                        onChange={(e) => setCustomNicheInput(e.target.value)}
                    />
                    {selectedTopic && !customNicheInput && (
                        <div className="text-xs text-neutral-500 flex items-center gap-1 font-mono">
                            <span>💡 Suggestion from brainstormer:</span>
                            <button 
                                onClick={() => setCustomNicheInput(selectedTopic.title)}
                                className="text-blue-400 hover:underline font-bold"
                            >
                                "{selectedTopic.title}"
                            </button>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div>
                        <label className="text-xs font-semibold text-neutral-400 block font-mono mb-2">Video Format / Type</label>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setVideoType('long')}
                                className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 ${videoType === 'long' ? 'bg-blue-600/10 border-blue-500/30 text-blue-400 font-bold' : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'}`}
                            >
                                <span>🎥</span> Long Form (16:9)
                            </button>
                            <button 
                                onClick={() => setVideoType('short')}
                                className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 ${videoType === 'short' ? 'bg-blue-600/10 border-blue-500/30 text-blue-400 font-bold' : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'}`}
                            >
                                <span>📱</span> Shorts/Reels (9:16)
                            </button>
                        </div>
                    </div>

                    {videoType === 'long' && (
                        <div>
                            <label className="text-xs font-semibold text-neutral-400 block font-mono mb-2">Target Duration (Minutes)</label>
                            <select
                                value={targetDuration}
                                onChange={(e) => setTargetDuration(parseInt(e.target.value))}
                                className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-3.5 rounded-xl text-xs text-neutral-200 outline-none font-mono"
                            >
                                <option value={2}>2 Minutes (Dynamic Scene Count)</option>
                                <option value={5}>5 Minutes (Dynamic Scene Count)</option>
                                <option value={8}>8 Minutes (Dynamic Scene Count)</option>
                                <option value={10}>10 Minutes (Dynamic Scene Count)</option>
                                <option value={12}>12 Minutes (Dynamic Scene Count)</option>
                                <option value={15}>15 Minutes (Dynamic Scene Count)</option>
                                <option value={20}>20 Minutes (Dynamic Scene Count)</option>
                                <option value={25}>25 Minutes (Dynamic Scene Count)</option>
                            </select>
                        </div>
                    )}
                </div>

                <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center pt-2">
                    {/* PIPELINE STAGES CHECKLIST */}
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-mono max-w-xl">
                        {pipelineStages.map(s => (
                            <div key={s.id} className="flex items-center gap-1.5">
                                <span className={`w-2.5 h-2.5 rounded-full ${s.status === 'completed' ? 'bg-green-500' : s.status === 'running' ? 'bg-blue-500 animate-pulse' : s.status === 'failed' ? 'bg-red-500' : 'bg-neutral-700'}`}></span>
                                <span className={`${s.status === 'running' ? 'text-blue-400 font-bold' : s.status === 'completed' ? 'text-neutral-350' : 'text-neutral-500'}`}>{s.label}</span>
                            </div>
                        ))}
                    </div>
                    {/* Show error if pipeline failed */}
                    {pipelineStages.some(s => s.status === 'failed') && (
                        <div className="bg-red-950/20 border border-red-500/30 p-3 rounded-xl text-red-400 text-xs font-mono">
                            ❌ Pipeline failed. Check logs above for details.
                        </div>
                    )}
                    
                    <div className="flex gap-2 w-full md:w-auto shrink-0">
                        <button 
                            onClick={() => runScriptGeneration(customNicheInput)}
                            disabled={isGenerating}
                            className="bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-bold px-7 py-4 rounded-2xl transition-all shadow-lg shadow-blue-600/15 flex items-center justify-center gap-2 glow-active w-full md:w-auto"
                        >
                            {isGenerating ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                    Generating...
                                </>
                            ) : (
                                '🚀 Launch Production Blueprint'
                            )}
                        </button>
                        {isGenerating && (
                            <button 
                                onClick={cancelScriptGeneration}
                                className="bg-red-700 hover:bg-red-650 text-white font-bold px-5 py-4 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 w-full md:w-auto"
                            >
                                🛑 Stop
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LOG STREAM */}
                <div className="lg:col-span-1 bg-neutral-900 border border-neutral-800 rounded-3xl p-5 flex flex-col h-[480px]">
                    <h3 className="text-xs uppercase tracking-widest font-mono text-neutral-500 mb-3 flex justify-between">
                        <span>Background Log Stream</span>
                        <span className="text-green-500 animate-pulse">● Active</span>
                    </h3>
                    <div className="flex-1 bg-neutral-950 rounded-2xl p-4 font-mono-code text-[11px] text-green-400 space-y-2.5 overflow-y-auto border border-neutral-800/80 shadow-inner">
                        {pipelineLogs.length === 0 ? (
                            <span className="text-neutral-600">// Engine arrays idle. Execute terminal run to initiate streams...</span>
                        ) : (
                            pipelineLogs.map((l, idx) => <div key={idx} className="leading-relaxed">{l}</div>)
                        )}
                        <div ref={logEndRef} />
                    </div>
                </div>

                {/* QUICK SCRIPT OVERVIEW */}
                <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-3xl p-6 flex flex-col h-[480px]">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xs uppercase tracking-widest font-mono text-neutral-500">Fast Preview Sandbox</h3>
                        {currentScript && (
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={copyEntireScriptToClipboard}
                                    className="text-xs text-neutral-450 hover:text-white font-semibold flex items-center gap-1 transition-colors"
                                >
                                    📋 Copy Script
                                </button>
                                <button 
                                    onClick={() => setActiveTab('sandbox')}
                                    className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors"
                                >
                                    Open Full Screen View ➔
                                </button>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                        {currentScript ? (
                            <div>
                                <div className="mb-4 pb-4 border-b border-neutral-800 flex justify-between items-start">
                                    <div>
                                        <div className="text-[10px] font-mono text-blue-400 mb-1">PROCESSED METRICS</div>
                                        <div className="text-lg font-black text-white tracking-tight leading-tight">{currentScript.title}</div>
                                        {currentScript.nicheReason && (
                                            <div className="text-[11px] text-neutral-400 mt-1 font-mono">
                                                🎯 <strong>Niche Viability:</strong> {currentScript.nicheReason}
                                            </div>
                                        )}
                                    </div>
                                    <div className="bg-neutral-950 text-neutral-400 text-xs px-3 py-1.5 rounded-xl border border-neutral-800 flex items-center gap-1.5 font-semibold shrink-0">
                                        ⚡ {currentScript.scenes.length} Scenes
                                    </div>
                                </div>

                                {/* ASSET SYNTHESIS & RENDERING CONTROLS */}
                                <div className="bg-neutral-950 border border-neutral-850 p-5 rounded-2xl mb-4 space-y-4 shadow-inner">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h4 className="text-xs font-bold font-mono text-neutral-350 uppercase tracking-wide">Autonomous Production Control</h4>
                                            <p className="text-[10px] text-neutral-500 mt-0.5">Synthesize script media assets, then stitch them into an MP4 video.</p>
                                        </div>
                                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${(synthesisStatus === 'completed' || currentScript?.assetsSynthesized) ? 'bg-green-950/20 text-green-400 border border-green-900/30' : synthesisStatus === 'running' ? 'bg-blue-900/30 text-blue-400 border border-blue-800/30 animate-pulse' : synthesisStatus === 'failed' ? 'bg-red-950/20 text-red-400 border border-red-900/30' : 'bg-neutral-905 text-neutral-500'}`}>
                                            {(synthesisStatus === 'completed' || currentScript?.assetsSynthesized) ? 'Assets Ready' : synthesisStatus === 'running' ? 'Synthesizing...' : synthesisStatus === 'failed' ? 'Synthesis Failed' : 'Ready'}
                                        </span>
                                    </div>
 
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <button
                                            onClick={runAssetSynthesis}
                                            disabled={isGenerating || synthesisStatus === 'running'}
                                            className="flex-1 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 hover:border-neutral-700 disabled:opacity-50 text-neutral-200 hover:text-white font-semibold py-3 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2"
                                        >
                                            <span>🎨</span> Synthesize Media Assets (Fal.ai & OpenRouter/ElevenLabs)
                                        </button>
 
                                        <button
                                            onClick={runVideoCompilation}
                                            disabled={isGenerating || (synthesisStatus !== 'completed' && !currentScript?.assetsSynthesized) || compileStatus === 'running'}
                                            className="flex-1 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 hover:border-blue-500/40 text-blue-400 hover:text-blue-300 font-semibold py-3 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            <span>🎬</span> Assemble Final Video (FFmpeg Compiler)
                                        </button>
                                    </div>

                                    {compileStatus === 'completed' && (
                                        <div className="space-y-4 animate-fadeIn w-full mt-4">
                                            <div className="bg-green-950/15 border border-green-500/25 text-green-400 p-3.5 rounded-xl text-xs font-mono flex items-center gap-2">
                                                <span>🎉</span>
                                                <span><strong>Success!</strong> MP4 Render completed and saved in the output directory.</span>
                                            </div>
                                            
                                            {currentScript?.videoPath && (
                                                <div className="bg-neutral-900/90 border border-neutral-800 p-5 rounded-2xl shadow-xl space-y-4">
                                                    <div className="flex justify-between items-center">
                                                        <h3 className="text-sm font-bold text-neutral-200 flex items-center gap-2">
                                                            <span>📺</span> Final Compilation Print
                                                        </h3>
                                                        <span className="text-[10px] bg-emerald-950/60 text-emerald-400 border border-emerald-900/40 px-2 py-0.5 rounded font-mono uppercase font-bold">Ready</span>
                                                    </div>
                                                    
                                                    <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-neutral-850 group">
                                                        <video 
                                                            src={getAssetUrl(currentScript.videoPath)} 
                                                            controls 
                                                            className="w-full h-full object-contain"
                                                        />
                                                    </div>
                                                    
                                                    <div className="flex flex-col sm:flex-row gap-3 pt-1">
                                                        <a 
                                                            href={getAssetUrl(currentScript.videoPath)} 
                                                            download 
                                                            className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 px-4 rounded-xl text-xs transition duration-200 shadow-lg shadow-emerald-900/20 active:scale-98"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                        >
                                                            <span>⬇️</span> Download Video (.mp4)
                                                        </a>
                                                        <a
                                                            href={getAssetUrl(currentScript.videoPath)}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center justify-center gap-2 bg-neutral-850 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 hover:border-neutral-600 font-semibold py-3 px-4 rounded-xl text-xs transition duration-200 active:scale-98"
                                                        >
                                                            <span>🔗</span> Open in New Tab
                                                        </a>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                
                                <div className="bg-amber-500/5 px-4 py-3 rounded-2xl border border-amber-500/20 mb-4 text-xs">
                                    <strong className="text-amber-500 block mb-1">AI Thumbnail Prompt:</strong>
                                    <span className="text-neutral-300">{currentScript.thumbnail}</span>
                                </div>

                                <div className="space-y-3">
                                    {currentScript.scenes.slice(0, 4).map((scene, i) => {
                                         return (
                                             <div key={i} className="bg-neutral-950 border border-neutral-800 p-4 rounded-2xl flex flex-col sm:flex-row gap-4 animate-fadeIn">
                                                 <div className="flex-1 space-y-2">
                                                     <div className="flex justify-between items-center text-xs">
                                                         <span className="bg-neutral-850 text-neutral-300 px-2 py-0.5 rounded font-mono font-bold">{scene.time} ({scene.duration}s)</span>
                                                         <span className="text-purple-400 font-mono font-medium">SFX: {scene.sfx}</span>
                                                     </div>
                                                     <p className="text-sm text-neutral-200">"{scene.voiceover}"</p>
                                                     <div className="text-[10px] font-mono text-neutral-500 leading-relaxed bg-neutral-900/60 p-2.5 rounded-xl border border-neutral-800 relative">
                                                         <div className="flex justify-between items-center mb-1">
                                                             <span className="text-neutral-450 block font-bold">Image Prompt:</span>
                                                             <button 
                                                                 onClick={() => copyToClipboard(scene.prompt, `preview_prompt_${i}`)}
                                                                 className={`text-[10px] font-bold px-2.5 py-0.5 rounded border transition-colors ${
                                                                     copiedField === `preview_prompt_${i}` 
                                                                         ? 'bg-green-950 border-green-500 text-green-400' 
                                                                         : 'bg-neutral-950 border-neutral-850 text-neutral-400 hover:text-white hover:border-neutral-750'
                                                                 }`}
                                                             >
                                                                 {copiedField === `preview_prompt_${i}` ? '✓ Copied!' : '📋 Copy'}
                                                             </button>
                                                         </div>
                                                         <span className="text-neutral-350 block select-all">{scene.prompt}</span>
                                                     </div>
                                                 </div>
                                             </div>
                                         );
                                     })}
                                    {currentScript.scenes.length > 4 && (
                                        <div className="text-center py-4">
                                            <button 
                                                onClick={() => setActiveTab('sandbox')}
                                                className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 text-xs font-bold px-5 py-2.5 rounded-xl transition"
                                            >
                                                View {currentScript.scenes.length - 4} More Scenes in Sandbox
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-neutral-600 gap-3">
                                <span className="text-4xl">📄</span>
                                <p className="text-xs">No script content has been compiled yet. Input a theme or run autonomously to generate.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
