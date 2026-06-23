import React from 'react';

export default function SandboxView({
    currentScript,
    setCurrentScript,
    isGenerating,
    copyEntireScriptToClipboard,
    autoFixFlaggedPromptsLocally,
    saveScriptToDisk,
    copiedField,
    copyToClipboard,
    getAssetUrl,
    handleCellEdit
}) {
    return (
        <div className="space-y-6 max-w-7xl">
            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between shadow-lg">
                <div>
                    <h2 className="text-xl font-bold text-white mb-1">Production Script Sandbox</h2>
                    <p className="text-sm text-neutral-400">Directly edit generated scripts in real time, audit stateless prompts, and save clean outputs.</p>
                </div>
                {currentScript && (
                    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                        <button 
                            onClick={copyEntireScriptToClipboard}
                            className="bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 text-neutral-200 hover:text-white font-bold px-4 py-2.5 rounded-xl text-xs transition flex items-center gap-1.5"
                        >
                            📋 Copy Full Script
                        </button>
                        <button 
                            onClick={autoFixFlaggedPromptsLocally}
                            disabled={isGenerating}
                            className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition flex items-center gap-1.5 animate-pulse"
                        >
                            🛡️ Auto-Fix QC Errors
                        </button>
                        <button 
                            onClick={() => saveScriptToDisk('json')}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition flex items-center gap-1.5"
                        >
                            💾 Save JSON to Disk
                        </button>
                        <button 
                            onClick={() => saveScriptToDisk('csv')}
                            className="bg-neutral-850 hover:bg-neutral-800 border border-neutral-750 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition"
                        >
                            Export CSV
                        </button>
                    </div>
                )}
            </div>

            {currentScript ? (
                <div className="space-y-6">

                    {/* SCRIPT META: Title + Thumbnail + SEO */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Compiled Video Player */}
                        {currentScript.videoPath && (
                            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl space-y-4 shadow-xl col-span-1 lg:col-span-2">
                                <h3 className="text-xs font-bold uppercase tracking-widest font-mono text-blue-400 flex items-center gap-2">
                                    <span>🎬</span> Generated Video Output
                                </h3>
                                <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black border border-neutral-800 relative">
                                    <video 
                                        src={getAssetUrl(currentScript.videoPath)} 
                                        controls 
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2">
                                    <span className="text-[10px] text-neutral-500 font-mono select-all">
                                        Web URL: {getAssetUrl(currentScript.videoPath)}
                                    </span>
                                    <a 
                                        href={getAssetUrl(currentScript.videoPath)} 
                                        download={`video_${currentScript.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.mp4`}
                                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition flex items-center gap-1.5 w-full sm:w-auto justify-center"
                                    >
                                        📥 Download Video
                                    </a>
                                </div>
                            </div>
                        )}

                        {/* Thumbnail Prompt */}
                        {currentScript.thumbnail && (
                            <div className="bg-gradient-to-br from-amber-950/20 to-neutral-900 border border-amber-500/20 p-5 rounded-3xl space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-bold uppercase tracking-widest font-mono text-amber-400">🖼️ AI Thumbnail Prompt</h3>
                                    <div className="flex gap-2">
                                        {currentScript.thumbnailPath && (
                                            <a
                                                href={getAssetUrl(currentScript.thumbnailPath)}
                                                download={`thumbnail_${currentScript.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.png`}
                                                className="text-[10px] font-bold px-2.5 py-1 rounded-lg border bg-amber-900/30 border-amber-800/30 text-amber-400 hover:text-white transition-all font-mono"
                                            >
                                                📥 Download Image
                                            </a>
                                        )}
                                        <button
                                            onClick={() => copyToClipboard(currentScript.thumbnail, 'thumbnail')}
                                            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all font-mono flex items-center gap-1 ${copiedField === 'thumbnail' ? 'bg-green-950/40 border-green-500/30 text-green-400' : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-600'}`}
                                        >
                                            {copiedField === 'thumbnail' ? '✓ Copied!' : '📋 Copy Prompt'}
                                        </button>
                                    </div>
                                </div>
                                
                                {currentScript.thumbnailPath && (
                                    <div className="aspect-video w-full rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-850 mb-3 flex items-center justify-center">
                                        <img 
                                            src={getAssetUrl(currentScript.thumbnailPath)} 
                                            alt="AI Generated Thumbnail" 
                                            className="max-h-full max-w-full object-contain"
                                        />
                                    </div>
                                )}
                                <textarea
                                    rows="4"
                                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-amber-500 p-3 rounded-2xl text-xs text-amber-200/80 font-mono leading-relaxed outline-none resize-none"
                                    value={currentScript.thumbnail}
                                    onChange={(e) => {
                                        const newVal = e.target.value;
                                        setCurrentScript(prev => ({ ...prev, thumbnail: newVal }));
                                    }}
                                />
                            </div>
                        )}

                        {/* Script Info */}
                        <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-3xl space-y-3">
                            <h3 className="text-xs font-bold uppercase tracking-widest font-mono text-neutral-400">📊 Script Info</h3>
                            <div className="space-y-3.5">
                                <div>
                                    <label className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider block mb-1">Title</label>
                                    <input
                                        type="text"
                                        className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-2.5 rounded-xl text-sm font-extrabold text-white outline-none"
                                        value={currentScript.title}
                                        onChange={(e) => {
                                            const newVal = e.target.value;
                                            setCurrentScript(prev => ({ ...prev, title: newVal }));
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider block mb-1">Category</label>
                                    <input
                                        type="text"
                                        className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-2.5 rounded-xl text-xs text-blue-400 font-mono font-bold outline-none"
                                        value={currentScript.category || ''}
                                        onChange={(e) => {
                                            const newVal = e.target.value;
                                            setCurrentScript(prev => ({ ...prev, category: newVal }));
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider block mb-1">Niche Viability</label>
                                    <textarea
                                        rows="2"
                                        className="w-full bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-2.5 rounded-xl text-[10px] text-neutral-400 font-mono leading-relaxed outline-none resize-none"
                                        value={currentScript.nicheReason || ''}
                                        onChange={(e) => {
                                            const newVal = e.target.value;
                                            setCurrentScript(prev => ({ ...prev, nicheReason: newVal }));
                                        }}
                                    />
                                </div>
                                <div className="flex gap-3 text-[10px] font-mono text-neutral-500 pt-1">
                                    <span>⚡ {currentScript.scenes?.length || 0} scenes</span>
                                    <span className="uppercase bg-neutral-850 px-1.5 py-0.5 rounded text-neutral-350">{currentScript.videoType || 'long'}</span>
                                    {currentScript.historyFilename && <span className="text-green-400 font-bold">💾 Auto-Saved</span>}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SEO METADATA PANEL */}
                    {currentScript.seoMetadata && (
                        <div className="bg-gradient-to-br from-emerald-950/20 to-neutral-900 border border-emerald-500/20 p-5 rounded-3xl space-y-4">
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-xs font-bold uppercase tracking-widest font-mono text-emerald-400">🌐 YouTube SEO Package</h3>
                                <span className="text-[9px] bg-emerald-950/40 text-emerald-300 border border-emerald-800/40 px-2 py-0.5 rounded-full font-bold font-mono">Ready to Copy-Paste</span>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                {/* Description */}
                                <div className="lg:col-span-1 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider font-bold">Video Description</label>
                                        <button
                                            onClick={() => copyToClipboard(currentScript.seoMetadata.description, 'seo-desc')}
                                            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all font-mono flex items-center gap-1 ${copiedField === 'seo-desc' ? 'bg-green-950/40 border-green-500/30 text-green-400' : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'}`}
                                        >
                                            {copiedField === 'seo-desc' ? '✓ Copied!' : '📋 Copy'}
                                        </button>
                                    </div>
                                    <textarea
                                        rows="5"
                                        className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 p-3 rounded-2xl text-xs text-neutral-300 font-mono leading-relaxed resize-none outline-none"
                                        value={currentScript.seoMetadata.description}
                                        onChange={(e) => {
                                            const newVal = e.target.value;
                                            setCurrentScript(prev => ({
                                                ...prev,
                                                seoMetadata: { ...prev.seoMetadata, description: newVal }
                                            }));
                                        }}
                                    />
                                </div>

                                {/* Hashtags */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider font-bold">Hashtags (Space Separated)</label>
                                        <button
                                            onClick={() => {
                                                const tags = Array.isArray(currentScript.seoMetadata.hashtags)
                                                    ? currentScript.seoMetadata.hashtags.join(' ')
                                                    : currentScript.seoMetadata.hashtags;
                                                copyToClipboard(tags, 'seo-hash');
                                            }}
                                            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all font-mono flex items-center gap-1 ${copiedField === 'seo-hash' ? 'bg-green-950/40 border-green-500/30 text-green-400' : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'}`}
                                        >
                                            {copiedField === 'seo-hash' ? '✓ Copied!' : '📋 Copy'}
                                        </button>
                                    </div>
                                    <textarea
                                        rows="5"
                                        className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 p-3 rounded-2xl text-xs text-neutral-300 font-mono leading-relaxed resize-none outline-none"
                                        value={
                                            Array.isArray(currentScript.seoMetadata.hashtags)
                                                ? currentScript.seoMetadata.hashtags.join(' ')
                                                : currentScript.seoMetadata.hashtags || ''
                                        }
                                        onChange={(e) => {
                                            const newVal = e.target.value;
                                            setCurrentScript(prev => ({
                                                ...prev,
                                                seoMetadata: { 
                                                    ...prev.seoMetadata, 
                                                    hashtags: newVal.split(/\s+/).filter(Boolean)
                                                }
                                            }));
                                        }}
                                    />
                                </div>

                                {/* Tags */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider font-bold">YouTube Tags</label>
                                        <button
                                            onClick={() => copyToClipboard(currentScript.seoMetadata.tags, 'seo-tags')}
                                            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all font-mono flex items-center gap-1 ${copiedField === 'seo-tags' ? 'bg-green-950/40 border-green-500/30 text-green-400' : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'}`}
                                        >
                                            {copiedField === 'seo-tags' ? '✓ Copied!' : '📋 Copy'}
                                        </button>
                                    </div>
                                    <textarea
                                        rows="5"
                                        className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 p-3 rounded-2xl text-xs text-neutral-300 font-mono leading-relaxed resize-none outline-none"
                                        value={currentScript.seoMetadata.tags || ''}
                                        onChange={(e) => {
                                            const newVal = e.target.value;
                                            setCurrentScript(prev => ({
                                                ...prev,
                                                seoMetadata: { ...prev.seoMetadata, tags: newVal }
                                            }));
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* DESKTOP TABLE VIEW */}
                    <div className="hidden md:block bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-neutral-950 border-b border-neutral-800 text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
                                        <th className="py-4 px-4 w-[85px]">Time</th>
                                        <th className="py-4 px-3 w-[100px]">Dur</th>
                                        <th className="py-4 px-4 w-[28%] min-w-[320px]">Voiceover Script</th>
                                        <th className="py-4 px-4 w-[14%] min-w-[150px]">SFX</th>
                                        <th className="py-4 px-4 w-[14%] min-w-[150px]">Camera</th>
                                        <th className="py-4 px-4 min-w-[400px]">Stateless Visual Prompt</th>
                                        <th className="py-4 px-4 w-[14%] min-w-[150px]">Overlay</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-800 text-sm">
                                    {currentScript.scenes.map((scene, i) => {
                                        const isFlagged = scene.qcErrors && scene.qcErrors.length > 0;
                                        return (
                                            <tr key={i} className={`hover:bg-neutral-950/40 transition-colors ${isFlagged ? 'bg-red-950/10 border-l-4 border-l-red-500' : ''}`}>
                                                <td className="py-3.5 px-4 font-mono font-bold text-neutral-400">
                                                    <input 
                                                        type="text" 
                                                        className="bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-2.5 w-full rounded-xl outline-none font-mono text-sm text-center text-neutral-200"
                                                        value={scene.time}
                                                        onChange={(e) => handleCellEdit(i, 'time', e.target.value)}
                                                    />
                                                </td>
                                                <td className="py-3.5 px-2">
                                                    <input 
                                                        type="number" 
                                                        className="bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-2 w-full rounded-xl outline-none text-center font-mono text-sm text-neutral-200"
                                                        value={scene.duration}
                                                        onChange={(e) => handleCellEdit(i, 'duration', parseInt(e.target.value) || 1)}
                                                    />
                                                </td>
                                                <td className="py-3.5 px-4">
                                                    <div className="relative group">
                                                        <textarea 
                                                            rows="5"
                                                            className="bg-neutral-950 border border-neutral-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 p-3.5 pb-10 w-full rounded-2xl outline-none resize-y leading-relaxed text-sm text-neutral-200 min-h-[140px]"
                                                            value={scene.voiceover}
                                                            onChange={(e) => handleCellEdit(i, 'voiceover', e.target.value)}
                                                        />
                                                        <button 
                                                            onClick={() => copyToClipboard(scene.voiceover, `voiceover_${i}`)}
                                                            className={`absolute bottom-2.5 right-2.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-mono font-bold transition-all z-10 ${
                                                                copiedField === `voiceover_${i}` 
                                                                    ? 'bg-green-950 border-green-500 text-green-400' 
                                                                    : 'bg-neutral-900 border-neutral-800 text-neutral-450 hover:text-white hover:border-neutral-700'
                                                            }`}
                                                            title="Copy Voiceover"
                                                        >
                                                            {copiedField === `voiceover_${i}` ? '✓ Copied!' : '📋 Copy'}
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-4">
                                                    <div className="relative group">
                                                        <textarea 
                                                            rows="3"
                                                            className="bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-3 pb-10 w-full rounded-2xl outline-none resize-y text-sm text-purple-400 font-semibold min-h-[85px]"
                                                            value={scene.sfx}
                                                            onChange={(e) => handleCellEdit(i, 'sfx', e.target.value)}
                                                        />
                                                        <button 
                                                            onClick={() => copyToClipboard(scene.sfx, `sfx_${i}`)}
                                                            className={`absolute bottom-2.5 right-2.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-mono font-bold transition-all z-10 ${
                                                                copiedField === `sfx_${i}` 
                                                                    ? 'bg-green-950 border-green-500 text-green-400' 
                                                                    : 'bg-neutral-900 border-neutral-800 text-neutral-450 hover:text-white hover:border-neutral-700'
                                                            }`}
                                                            title="Copy SFX"
                                                        >
                                                            {copiedField === `sfx_${i}` ? '✓ Copied!' : '📋 Copy'}
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-4">
                                                    <div className="relative group">
                                                        <textarea 
                                                            rows="3"
                                                            className="bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-3 pb-10 w-full rounded-2xl outline-none resize-y text-sm text-sky-400 min-h-[85px]"
                                                            value={scene.camera}
                                                            onChange={(e) => handleCellEdit(i, 'camera', e.target.value)}
                                                        />
                                                        <button 
                                                            onClick={() => copyToClipboard(scene.camera, `camera_${i}`)}
                                                            className={`absolute bottom-2.5 right-2.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-mono font-bold transition-all z-10 ${
                                                                copiedField === `camera_${i}` 
                                                                    ? 'bg-green-950 border-green-500 text-green-400' 
                                                                    : 'bg-neutral-900 border-neutral-800 text-neutral-450 hover:text-white hover:border-neutral-700'
                                                            }`}
                                                            title="Copy Camera Settings"
                                                        >
                                                            {copiedField === `camera_${i}` ? '✓ Copied!' : '📋 Copy'}
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-4">
                                                    <div className="relative group">
                                                        <textarea 
                                                            rows="6"
                                                            className={`bg-neutral-950 border border-neutral-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 p-3.5 pb-10 w-full rounded-2xl outline-none text-sm font-mono leading-normal text-neutral-300 resize-y min-h-[180px] ${isFlagged ? 'border-red-500 focus:border-red-500' : ''}`}
                                                            value={scene.prompt}
                                                            onChange={(e) => handleCellEdit(i, 'prompt', e.target.value)}
                                                        />
                                                        <button 
                                                            onClick={() => copyToClipboard(scene.prompt, `prompt_${i}`)}
                                                            className={`absolute bottom-2.5 right-2.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-mono font-bold transition-all z-10 ${
                                                                copiedField === `prompt_${i}` 
                                                                    ? 'bg-green-950 border-green-500 text-green-400' 
                                                                    : 'bg-neutral-900 border-neutral-800 text-neutral-450 hover:text-white hover:border-neutral-700'
                                                            }`}
                                                            title="Copy Prompt"
                                                        >
                                                            {copiedField === `prompt_${i}` ? '✓ Copied!' : '📋 Copy'}
                                                        </button>
                                                        {isFlagged && (
                                                            <div className="absolute left-2.5 bottom-2.5 bg-red-650 text-white font-bold text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse font-mono">
                                                                ⚠️ Pronoun Leak: {scene.qcErrors.join(', ')}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-4">
                                                    <div className="relative group">
                                                        <textarea 
                                                            rows="3"
                                                            className="bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-3 pb-10 w-full rounded-2xl outline-none resize-y text-sm text-amber-500 font-bold min-h-[85px]"
                                                            value={scene.textOverlay || ''}
                                                            placeholder="--"
                                                            onChange={(e) => handleCellEdit(i, 'textOverlay', e.target.value)}
                                                        />
                                                        <button 
                                                            onClick={() => copyToClipboard(scene.textOverlay || '', `overlay_${i}`)}
                                                            className={`absolute bottom-2.5 right-2.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-mono font-bold transition-all z-10 ${
                                                                copiedField === `overlay_${i}` 
                                                                    ? 'bg-green-950 border-green-500 text-green-400' 
                                                                    : 'bg-neutral-900 border-neutral-800 text-neutral-450 hover:text-white hover:border-neutral-700'
                                                            }`}
                                                            title="Copy Overlay Text"
                                                        >
                                                            {copiedField === `overlay_${i}` ? '✓ Copied!' : '📋 Copy'}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* MOBILE CARD VIEW */}
                    <div className="block md:hidden space-y-4">
                        {currentScript.scenes.map((scene, i) => {
                            const isFlagged = scene.qcErrors && scene.qcErrors.length > 0;
                            return (
                                <div key={i} className={`bg-neutral-900 border border-neutral-800 p-5 rounded-3xl space-y-4 relative ${isFlagged ? 'border-red-500/50' : ''}`}>
                                    {/* Scene Header */}
                                    <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
                                        <span className="font-extrabold text-sm text-neutral-300 font-mono">Scene #{i + 1}</span>
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-1">
                                                <span className="text-[10px] text-neutral-500 font-mono">Time:</span>
                                                <input 
                                                    type="text" 
                                                    className="bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-1.5 w-16 rounded-xl outline-none font-mono text-xs text-center text-neutral-200"
                                                    value={scene.time}
                                                    onChange={(e) => handleCellEdit(i, 'time', e.target.value)}
                                                />
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-[10px] text-neutral-500 font-mono">Dur:</span>
                                                <input 
                                                    type="number" 
                                                    className="bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-1.5 w-16 rounded-xl outline-none text-center font-mono text-xs text-neutral-200"
                                                    value={scene.duration}
                                                    onChange={(e) => handleCellEdit(i, 'duration', parseInt(e.target.value) || 1)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Voiceover Script */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider font-bold">Voiceover Script</label>
                                            <button 
                                                onClick={() => copyToClipboard(scene.voiceover, `voiceover_m_${i}`)}
                                                className={`text-[9px] font-bold px-2 py-1 rounded border transition-all font-mono flex items-center gap-1 ${
                                                    copiedField === `voiceover_m_${i}` 
                                                        ? 'bg-green-950 border-green-500 text-green-400' 
                                                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                                                }`}
                                            >
                                                {copiedField === `voiceover_m_${i}` ? '✓ Copied!' : '📋 Copy'}
                                            </button>
                                        </div>
                                        <textarea 
                                            rows="5"
                                            className="bg-neutral-950 border border-neutral-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 p-3 w-full rounded-2xl outline-none resize-y leading-relaxed text-sm text-neutral-200 min-h-[120px]"
                                            value={scene.voiceover}
                                            onChange={(e) => handleCellEdit(i, 'voiceover', e.target.value)}
                                        />
                                    </div>
                                    
                                    {/* SFX & Camera */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-center">
                                                <label className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider font-bold">SFX</label>
                                                <button 
                                                    onClick={() => copyToClipboard(scene.sfx, `sfx_m_${i}`)}
                                                    className={`text-[9px] font-bold px-2 py-0.5 rounded border transition-all font-mono flex items-center gap-1 ${
                                                        copiedField === `sfx_m_${i}` 
                                                            ? 'bg-green-950 border-green-500 text-green-400' 
                                                            : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                                                    }`}
                                                >
                                                    {copiedField === `sfx_m_${i}` ? '✓ Copied!' : '📋 Copy'}
                                                </button>
                                            </div>
                                            <textarea 
                                                rows="3"
                                                className="bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-2.5 w-full rounded-xl outline-none resize-y text-sm text-purple-400 font-semibold min-h-[80px]"
                                                value={scene.sfx}
                                                onChange={(e) => handleCellEdit(i, 'sfx', e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-center">
                                                <label className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider font-bold">Camera</label>
                                                <button 
                                                    onClick={() => copyToClipboard(scene.camera, `camera_m_${i}`)}
                                                    className={`text-[9px] font-bold px-2 py-0.5 rounded border transition-all font-mono flex items-center gap-1 ${
                                                        copiedField === `camera_m_${i}` 
                                                            ? 'bg-green-950 border-green-500 text-green-400' 
                                                            : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                                                    }`}
                                                >
                                                    {copiedField === `camera_m_${i}` ? '✓ Copied!' : '📋 Copy'}
                                                </button>
                                            </div>
                                            <textarea 
                                                rows="3"
                                                className="bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-2.5 w-full rounded-xl outline-none resize-y text-sm text-sky-400 min-h-[80px]"
                                                value={scene.camera}
                                                onChange={(e) => handleCellEdit(i, 'camera', e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {/* Stateless Visual Prompt */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider font-bold">Stateless Visual Prompt</label>
                                            <button 
                                                onClick={() => copyToClipboard(scene.prompt, `prompt_m_${i}`)}
                                                className={`text-[9px] font-bold px-2 py-1 rounded border transition-all font-mono flex items-center gap-1 ${
                                                    copiedField === `prompt_m_${i}` 
                                                        ? 'bg-green-950 border-green-500 text-green-400' 
                                                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                                                }`}
                                            >
                                                {copiedField === `prompt_m_${i}` ? '✓ Copied!' : '📋 Copy'}
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <textarea 
                                                rows="6"
                                                className={`bg-neutral-950 border border-neutral-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 p-3 w-full rounded-2xl outline-none text-sm font-mono leading-normal text-neutral-300 resize-y min-h-[180px] ${isFlagged ? 'border-red-500 focus:border-red-500' : ''}`}
                                                value={scene.prompt}
                                                onChange={(e) => handleCellEdit(i, 'prompt', e.target.value)}
                                            />
                                            {isFlagged && (
                                                <div className="absolute left-2.5 bottom-2.5 bg-red-650 text-white font-bold text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse font-mono">
                                                    ⚠️ Pronoun Leak: {scene.qcErrors.join(', ')}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Text Overlay */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider font-bold">Text Overlay</label>
                                            <button 
                                                onClick={() => copyToClipboard(scene.textOverlay || '', `overlay_m_${i}`)}
                                                className={`text-[9px] font-bold px-2 py-0.5 rounded border transition-all font-mono flex items-center gap-1 ${
                                                    copiedField === `overlay_m_${i}` 
                                                        ? 'bg-green-950 border-green-500 text-green-400' 
                                                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                                                }`}
                                            >
                                                {copiedField === `overlay_m_${i}` ? '✓ Copied!' : '📋 Copy'}
                                            </button>
                                        </div>
                                        <textarea 
                                            rows="3"
                                            className="bg-neutral-950 border border-neutral-800 focus:border-blue-500 p-2.5 w-full rounded-xl outline-none resize-y text-sm text-amber-500 font-bold min-h-[80px]"
                                            value={scene.textOverlay || ''}
                                            placeholder="--"
                                            onChange={(e) => handleCellEdit(i, 'textOverlay', e.target.value)}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="h-96 flex flex-col items-center justify-center text-neutral-600 gap-3 border-2 border-dashed border-neutral-850 rounded-3xl bg-neutral-900/10">
                    <span className="text-5xl block animate-bounce mb-2">📄</span>
                    <p className="text-sm max-w-md mx-auto text-center font-medium">No script has been generated yet. Input a theme or run autonomously to generate a complete script.</p>
                </div>
            )}
        </div>
    );
}
