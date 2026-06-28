import React from 'react';

export default function VideosView({
    scriptHistory,
    getAssetUrl,
    copiedField,
    copyToClipboard
}) {
    const compiledScripts = scriptHistory.filter(s => s.videoPath);

    return (
        <div className="space-y-6 max-w-7xl">
            {/* Header */}
            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between shadow-lg">
                <div>
                    <h2 className="text-xl font-bold text-white mb-1">🎬 Generated Videos Hub</h2>
                    <p className="text-sm text-neutral-400">Watch, download, and copy metadata for all of your compiled explainer videos to upload directly to YouTube.</p>
                </div>
                <div className="bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 px-4 py-2 rounded-xl text-xs font-mono font-bold">
                    🚀 {compiledScripts.length} Videos Compiled
                </div>
            </div>

            {compiledScripts.length === 0 ? (
                <div className="h-96 flex flex-col items-center justify-center text-neutral-600 gap-3 border-2 border-dashed border-neutral-850 rounded-3xl bg-neutral-900/10">
                    <span className="text-5xl block animate-bounce mb-2">🎥</span>
                    <p className="text-sm max-w-md mx-auto text-center font-medium">No videos have been compiled yet. Go to the Execution Terminal or Script Sandbox, synthesize media assets, and assemble the final video.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
                    {compiledScripts.map((script, idx) => {
                        const dateStr = script.timestamp ? new Date(script.timestamp).toLocaleString() : 'Unknown date';
                        
                        // Parse description & tags for YouTube
                        const ytTitle = script.title || 'Untitled Explainer';
                        const ytDesc = script.seoMetadata?.description || '';
                        
                        const ytTags = script.seoMetadata?.tags || '';
                        const ytHashtags = Array.isArray(script.seoMetadata?.hashtags)
                            ? script.seoMetadata.hashtags.join(' ')
                            : script.seoMetadata?.hashtags || '';

                        const fullDescriptionText = `${ytDesc}\n\n${ytHashtags}`;

                        return (
                            <div key={idx} className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-6 flex flex-col justify-between hover:border-neutral-700 transition-all duration-355">
                                <div className="space-y-4">
                                    {/* Card Header */}
                                    <div className="flex justify-between items-start gap-4">
                                        <div>
                                            <h3 className="text-base font-black text-white leading-tight">{script.title}</h3>
                                            <div className="flex items-center gap-2 mt-1.5 text-xs text-neutral-500 font-mono">
                                                <span className="uppercase text-[9px] bg-neutral-800 text-neutral-355 px-2 py-0.5 rounded font-bold">{script.videoType || 'long'}</span>
                                                <span>•</span>
                                                <span>{dateStr}</span>
                                            </div>
                                        </div>
                                        <span className="text-[10px] bg-emerald-950/60 text-emerald-400 border border-emerald-900/40 px-2 py-0.5 rounded font-mono uppercase font-bold">READY TO PUBLISH</span>
                                    </div>

                                    {/* Video Player */}
                                    <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black border border-neutral-850 relative group">
                                        <video 
                                            src={getAssetUrl(script.videoPath)} 
                                            controls 
                                            className="w-full h-full object-contain"
                                        />
                                    </div>

                                    {/* File details & download */}
                                    <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-950/45 border border-neutral-850 p-3 rounded-2xl">
                                        <span className="text-[10px] font-mono text-neutral-500 select-all truncate max-w-[200px] sm:max-w-xs">
                                            {script.videoPath}
                                        </span>
                                        <div className="flex gap-2 w-full sm:w-auto">
                                            <button 
                                                onClick={async () => {
                                                    try {
                                                        const res = await fetch(getAssetUrl(script.videoPath));
                                                        if (!res.ok) {
                                                            // If fetch fails, open in new tab as fallback
                                                            window.open(getAssetUrl(script.videoPath), '_blank');
                                                            return;
                                                        }
                                                        const blob = await res.blob();
                                                        const blobUrl = URL.createObjectURL(blob);
                                                        const link = document.createElement('a');
                                                        link.href = blobUrl;
                                                        link.download = `video_${script.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.mp4`;
                                                        document.body.appendChild(link);
                                                        link.click();
                                                        document.body.removeChild(link);
                                                    } catch (err) {
                                                        window.open(getAssetUrl(script.videoPath), '_blank');
                                                    }
                                                }}
                                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 justify-center flex-1 sm:flex-none shadow-lg shadow-emerald-950/20 active:scale-98"
                                            >
                                                📥 Download MP4
                                            </button>
                                            
                                            {script.thumbnailPath && (
                                                <a 
                                                    href={getAssetUrl(script.thumbnailPath)}
                                                    download={`thumbnail_${script.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.png`}
                                                    className="bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 text-neutral-200 font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 justify-center flex-1 sm:flex-none"
                                                >
                                                    🖼️ Thumbnail
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    {/* YouTube Metadata Fields */}
                                    <div className="space-y-4 pt-2 border-t border-neutral-800/60">
                                        <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest font-mono">📱 YouTube Publisher Pack</h4>
                                        
                                        {/* YT Title */}
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between items-center">
                                                <label className="text-[10px] font-mono text-neutral-450 uppercase tracking-wider font-bold">YouTube Video Title</label>
                                                <button
                                                    onClick={() => copyToClipboard(ytTitle, `yt-title-${idx}`)}
                                                    className={`text-[9px] font-bold px-2 py-0.5 rounded border transition-all font-mono ${
                                                        copiedField === `yt-title-${idx}`
                                                            ? 'bg-green-950 border-green-500 text-green-400'
                                                            : 'bg-neutral-950 border-neutral-800 text-neutral-450 hover:text-white'
                                                    }`}
                                                >
                                                    {copiedField === `yt-title-${idx}` ? '✓ Copied' : '📋 Copy Title'}
                                                </button>
                                            </div>
                                            <input
                                                type="text"
                                                readOnly
                                                className="w-full bg-neutral-950 border border-neutral-850 p-2.5 rounded-xl text-xs text-neutral-300 font-mono outline-none"
                                                value={ytTitle}
                                            />
                                        </div>

                                        {/* YT Description */}
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between items-center">
                                                <label className="text-[10px] font-mono text-neutral-450 uppercase tracking-wider font-bold">YouTube Description & Hashtags</label>
                                                <button
                                                    onClick={() => copyToClipboard(fullDescriptionText, `yt-desc-${idx}`)}
                                                    className={`text-[9px] font-bold px-2 py-0.5 rounded border transition-all font-mono ${
                                                        copiedField === `yt-desc-${idx}`
                                                            ? 'bg-green-950 border-green-500 text-green-400'
                                                            : 'bg-neutral-950 border-neutral-800 text-neutral-450 hover:text-white'
                                                    }`}
                                                >
                                                    {copiedField === `yt-desc-${idx}` ? '✓ Copied' : '📋 Copy Description'}
                                                </button>
                                            </div>
                                            <textarea
                                                rows="4"
                                                readOnly
                                                className="w-full bg-neutral-950 border border-neutral-850 p-2.5 rounded-xl text-xs text-neutral-300 font-mono leading-relaxed outline-none resize-none"
                                                value={fullDescriptionText}
                                            />
                                        </div>

                                        {/* YT Tags */}
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between items-center">
                                                <label className="text-[10px] font-mono text-neutral-450 uppercase tracking-wider font-bold">Tags (Comma Separated)</label>
                                                <button
                                                    onClick={() => copyToClipboard(ytTags, `yt-tags-${idx}`)}
                                                    className={`text-[9px] font-bold px-2 py-0.5 rounded border transition-all font-mono ${
                                                        copiedField === `yt-tags-${idx}`
                                                            ? 'bg-green-950 border-green-500 text-green-400'
                                                            : 'bg-neutral-950 border-neutral-800 text-neutral-450 hover:text-white'
                                                    }`}
                                                >
                                                    {copiedField === `yt-tags-${idx}` ? '✓ Copied' : '📋 Copy Tags'}
                                                </button>
                                            </div>
                                            <textarea
                                                rows="2"
                                                readOnly
                                                className="w-full bg-neutral-950 border border-neutral-850 p-2.5 rounded-xl text-[10px] text-neutral-350 font-mono leading-relaxed outline-none resize-none"
                                                value={ytTags}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
