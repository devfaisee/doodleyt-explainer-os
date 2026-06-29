import React, { useState } from 'react';

export default function StudioView({ script, runVideoCompilation, compileStatus, isGenerating, getAssetUrl }) {
    const [editedPrompts, setEditedPrompts] = useState({});
    const [editedVoiceovers, setEditedVoiceovers] = useState({});
    const [assetTimestamps, setAssetTimestamps] = useState({});
    const [isRegenerating, setIsRegenerating] = useState({});

    if (!script || !script.scenes || !Array.isArray(script.scenes)) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-neutral-600 gap-3">
                <span className="text-4xl">📄</span>
                <p className="text-xs">No script content has been compiled yet. Input a theme or run autonomously to generate.</p>
            </div>
        );
    }

    const getAudioFileName = (title, idx) => {
        const safeTitle = title || 'untitled';
        const firstTwo = safeTitle.split(' ').slice(0, 2).join('-').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
        return `${firstTwo}-voiceover-${String(idx+1).padStart(2, '0')}.mp3`;
    };

    const handleRegenerate = async (idx, type) => {
        const isAudio = type === 'audio';
        const key = `${type}_${idx}`;
        setIsRegenerating(prev => ({ ...prev, [key]: true }));
        try {
            const text = isAudio 
                ? (editedVoiceovers[idx] !== undefined ? editedVoiceovers[idx] : script.scenes[idx].voiceover)
                : (editedPrompts[idx] !== undefined ? editedPrompts[idx] : script.scenes[idx].prompt);
            
            const payload = {
                sceneIndex: idx,
                type,
                text,
                scriptTitle: script.title,
                apiKey: localStorage.getItem('doodleyt_api_key')
            };
            if (!isAudio) payload.videoType = script.videoType;

            const res = await fetch('http://localhost:3000/api/regenerate-asset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                setAssetTimestamps(prev => ({ ...prev, [idx]: Date.now() }));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsRegenerating(prev => ({ ...prev, [key]: false }));
        }
    };

    return (
        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl mt-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Storyboard Editor</h3>
            <div className="grid grid-cols-1 gap-4 max-h-[600px] overflow-y-auto pr-2">
                {script.scenes.map((scene, idx) => {
                    const sceneNum = String(idx + 1).padStart(3, '0');
                    const currentPrompt = editedPrompts[idx] !== undefined ? editedPrompts[idx] : scene.prompt;
                    const currentVoiceover = editedVoiceovers[idx] !== undefined ? editedVoiceovers[idx] : scene.voiceover;
                    
                    return (
                        <div key={idx} className="flex gap-4 items-start bg-neutral-950 p-4 rounded-xl border border-neutral-800">
                            <img 
                                src={`${getAssetUrl(`/output/images/scene_${sceneNum}.png`)}?t=${assetTimestamps[idx] || ''}`} 
                                alt={`Scene ${sceneNum}`} 
                                className="w-32 h-auto rounded-lg border border-neutral-700 object-cover mt-1" 
                            />
                            <div className="flex-1 space-y-3">
                                <div className="text-sm font-bold text-blue-400">Scene {sceneNum}</div>
                                
                                <div className="flex gap-3 items-start">
                                    <div className="flex-1">
                                        <textarea 
                                            value={currentVoiceover}
                                            onChange={(e) => setEditedVoiceovers(prev => ({ ...prev, [idx]: e.target.value }))}
                                            className="w-full bg-neutral-900 border border-neutral-800 p-2 text-sm text-white rounded outline-none" 
                                            rows={2}
                                        />
                                        <audio 
                                            controls 
                                            src={`${getAssetUrl(`/output/audio/${getAudioFileName(script.title, idx)}`)}?t=${assetTimestamps[idx] || ''}`} 
                                            className="h-8 w-full mt-2" 
                                        />
                                    </div>
                                    <button 
                                        onClick={() => handleRegenerate(idx, 'audio')}
                                        disabled={isRegenerating[`audio_${idx}`]}
                                        className="bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30 disabled:opacity-50 text-xs px-3 py-2 rounded-lg font-bold transition-colors whitespace-nowrap shrink-0"
                                    >
                                        {isRegenerating[`audio_${idx}`] ? '⏳...' : '🎙️ Regen Audio'}
                                    </button>
                                </div>
                                
                                <div className="flex gap-3 items-start">
                                    <textarea 
                                        value={currentPrompt}
                                        onChange={(e) => setEditedPrompts(prev => ({ ...prev, [idx]: e.target.value }))}
                                        className="w-full bg-neutral-900 border border-neutral-800 p-2 text-sm text-neutral-400 rounded outline-none" 
                                        rows={2}
                                    />
                                    <button 
                                        onClick={() => handleRegenerate(idx, 'image')}
                                        disabled={isRegenerating[`image_${idx}`]}
                                        className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 disabled:opacity-50 text-xs px-3 py-2 rounded-lg font-bold transition-colors whitespace-nowrap shrink-0"
                                    >
                                        {isRegenerating[`image_${idx}`] ? '⏳...' : '🎨 Regen Image'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            <button 
                onClick={() => {
                    if (compileStatus !== 'running') {
                        runVideoCompilation();
                    }
                }}
                disabled={isGenerating || compileStatus === 'running'}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:bg-neutral-800 disabled:cursor-not-allowed text-white font-black text-xl py-6 rounded-2xl transition-colors shadow-lg shadow-blue-600/20"
            >
                {compileStatus === 'running' ? 'Assembling Video...' : 'Assemble Final Video'}
            </button>
        </div>
    );
}
