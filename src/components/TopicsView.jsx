import React from 'react';

export default function TopicsView({
    topicBank,
    selectedTopic,
    setSelectedTopic,
    setCustomNicheInput,
    addLog,
    setActiveTab,
    isGenerating,
    generateTopicsViaAI,
    removeBrainstormTopic
}) {
    return (
        <div className="space-y-6 max-w-4xl">
            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl flex justify-between items-center shadow-lg">
                <div>
                    <h2 className="text-xl font-bold text-white mb-1">Niche Brainstormer Matrix</h2>
                    <p className="text-sm text-neutral-400">Autonomously researches highly targeted, specific, bizarre niches. Click any topic to load it into the terminal.</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => generateTopicsViaAI(false)}
                        disabled={isGenerating}
                        className="bg-neutral-800 hover:bg-neutral-750 disabled:bg-neutral-900 disabled:text-neutral-600 border border-neutral-700 text-white font-semibold px-5 py-2.5 rounded-xl transition flex items-center gap-2"
                    >
                        Research Standard Niches
                    </button>
                    <button 
                        onClick={() => generateTopicsViaAI(true)}
                        disabled={isGenerating}
                        className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-900/20 transition flex items-center gap-2"
                    >
                        ✨ Invent New Niches
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {topicBank.map(t => (
                    <div 
                        key={t.id} 
                        onClick={() => {
                            setSelectedTopic(t);
                            setCustomNicheInput(t.title);
                            addLog(`Brainstorm topic locked: "${t.title}"`);
                            setActiveTab('terminal');
                        }}
                        className={`p-5 rounded-3xl border-2 cursor-pointer transition-all flex flex-col justify-between h-[225px] ${
                            selectedTopic && selectedTopic.id === t.id 
                                ? 'bg-blue-600/10 border-blue-500 text-white shadow-lg shadow-blue-500/5' 
                                : 'bg-neutral-900/60 border-neutral-850 text-neutral-450 hover:border-neutral-700'
                        }`}
                    >
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-[10px] font-mono bg-neutral-800 text-neutral-350 px-2 py-1 rounded-md font-bold uppercase tracking-wider">{t.cat}</span>
                                <div className="flex gap-3 items-center">
                                    <span className="text-[11px] font-bold font-mono text-blue-400">C: {t.curiosity}</span>
                                    <span className="text-[11px] font-bold font-mono text-emerald-400">N: {t.novelty}</span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeBrainstormTopic(t.id);
                                        }}
                                        className="bg-neutral-850/80 hover:bg-red-950/40 border border-neutral-800 hover:border-red-900/60 text-neutral-400 hover:text-red-400 transition-all rounded-lg p-1.5 flex items-center justify-center"
                                        title="Dismiss/Delete Idea"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <h4 className="font-extrabold text-base text-neutral-100 line-clamp-2 leading-snug">{t.title}</h4>
                            <p className="text-xs text-neutral-450 line-clamp-2 mt-2 leading-relaxed">"{t.hook}"</p>
                        </div>
                        <div className="pt-3 border-t border-neutral-850/80 flex justify-between items-center">
                            <span className="text-[10px] font-bold tracking-wider text-neutral-500 font-mono">SCORE: {((t.curiosity + t.novelty) * 5).toFixed(0)}%</span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTopic(t);
                                    setCustomNicheInput(t.title);
                                    addLog(`Brainstorm topic locked: "${t.title}"`);
                                    setActiveTab('terminal');
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    selectedTopic && selectedTopic.id === t.id
                                        ? 'bg-blue-600 text-white shadow shadow-blue-500/10 hover:bg-blue-500'
                                        : 'bg-neutral-850 text-neutral-300 hover:bg-neutral-800 border border-neutral-750 hover:border-neutral-700'
                                }`}
                            >
                                {selectedTopic && selectedTopic.id === t.id ? '✓ Selected' : 'Select Topic'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
