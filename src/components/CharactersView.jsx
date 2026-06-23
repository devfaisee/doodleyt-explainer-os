import React from 'react';

export default function CharactersView({
    characters,
    setCharacters,
    saveConfig
}) {
    return (
        <div className="space-y-6 max-w-4xl">
            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl shadow-lg">
                <h2 className="text-xl font-bold text-white mb-1">Custom Character DNA Registry</h2>
                <p className="text-sm text-neutral-400 mb-6 font-medium">These are the visual characters generated autonomously by the AI for your current script. They are dynamically populated after each pipeline run.</p>
                
                <div className="space-y-4">
                    {characters.length > 0 ? (
                        characters.map((char, index) => (
                            <div key={char.name} className="bg-neutral-950 border border-neutral-850 p-5 rounded-2xl space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="font-extrabold text-sm text-blue-400 font-mono">Character ID: {char.name}</span>
                                    <span className="text-[10px] text-neutral-500 font-mono">AI Generated visual preset</span>
                                </div>
                                <div>
                                    <label className="text-[10px] text-neutral-500 uppercase tracking-widest font-mono block mb-1">Visual Prompt DNA Injector String</label>
                                    <textarea 
                                        rows="2"
                                        className="w-full bg-neutral-900 border border-neutral-800 focus:border-blue-500 p-3 rounded-xl text-xs text-neutral-200 outline-none resize-none font-mono"
                                        value={char.description}
                                        onChange={(e) => {
                                            const updated = [...characters];
                                            updated[index].description = e.target.value;
                                            setCharacters(updated);
                                            saveConfig({ characters: updated });
                                        }}
                                    />
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-6 text-neutral-500 text-xs">
                            No characters generated yet. Compile a script to populate this list dynamically!
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
