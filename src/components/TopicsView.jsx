import React from 'react';

export default function TopicsView({
    topicBank,
    selectedTopic,
    setSelectedTopic,
    setCustomNicheInput,
    addLog,
    setActiveTab,
    isGenerating,
    generateTopicsViaAI
}) {
    return (
        <div className="space-y-6 max-w-4xl">
            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl flex justify-between items-center shadow-lg">
                <div>
                    <h2 className="text-xl font-bold text-white mb-1">Niche Brainstormer Matrix</h2>
                    <p className="text-sm text-neutral-400">Autonomously researches highly targeted, specific, bizarre niches. Click any topic to load it into the terminal.</p>
                </div>
                <button 
                    onClick={generateTopicsViaAI}
                    disabled={isGenerating}
                    className="bg-neutral-800 hover:bg-neutral-750 disabled:bg-neutral-900 disabled:text-neutral-600 border border-neutral-700 text-white font-semibold px-5 py-2.5 rounded-xl transition flex items-center gap-2"
                >
                    Research AI Niches
                </button>
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
                        className={`p-5 rounded-3xl border-2 cursor-pointer transition-all flex flex-col justify-between h-[210px] ${
                            selectedTopic && selectedTopic.id === t.id 
                                ? 'bg-blue-600/10 border-blue-500 text-white shadow-lg shadow-blue-500/5' 
                                : 'bg-neutral-900/60 border-neutral-850 text-neutral-450 hover:border-neutral-700'
                        }`}
                    >
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-[10px] font-mono bg-neutral-800 text-neutral-350 px-2 py-1 rounded-md font-bold uppercase tracking-wider">{t.cat}</span>
                                <div className="flex gap-2">
                                    <span className="text-[11px] font-bold font-mono text-blue-400">C: {t.curiosity}</span>
                                    <span className="text-[11px] font-bold font-mono text-emerald-400">N: {t.novelty}</span>
                                </div>
                            </div>
                            <h4 className="font-extrabold text-base text-neutral-100 line-clamp-2 leading-snug">{t.title}</h4>
                            <p className="text-xs text-neutral-400 line-clamp-3 mt-2 leading-relaxed">"{t.hook}"</p>
                        </div>
                        <div className="pt-3 border-t border-neutral-800/60 flex justify-between text-[10px] font-mono text-neutral-500">
                            <span>VIRAL SCORE: HIGH</span>
                            <span>SELECT & CONFIGURE</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
