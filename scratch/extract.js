const fs = require('fs');
const path = require('path');

const src = fs.readFileSync('E:/doodleyt/server.cjs', 'utf8');

// We want to extract startBackendScriptGeneration, startBackendSynthesis, startBackendAssembly
// and the history functions.

function extractFunction(name) {
    const regex = new RegExp(`async function ${name}\\([\\s\\S]*?\\n}`);
    const match = src.match(regex);
    if (match) return match[0];
    const regex2 = new RegExp(`function ${name}\\([\\s\\S]*?\\n}`);
    const match2 = src.match(regex2);
    if (match2) return match2[0];
    return null;
}

const historyFuncs = [
    'saveScriptToHistory', 'listScriptHistory', 'loadScriptFromHistory', 
    'deleteScriptFromHistory', 'updateScriptInHistory', 'mapRowToScriptSummary'
];

let historyCode = historyFuncs.map(extractFunction).join('\n\n');
fs.writeFileSync('E:/doodleyt/src/server/services/history.service.js', historyCode);
