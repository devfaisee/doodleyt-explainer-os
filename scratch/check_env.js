console.log("--- Environment Keys Check ---");
console.log("OPENROUTER_API_KEY:", process.env.OPENROUTER_API_KEY ? "Found (length: " + process.env.OPENROUTER_API_KEY.length + ")" : "Not Found");
console.log("GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? "Found" : "Not Found");
console.log("FAL_API_KEY:", process.env.FAL_API_KEY ? "Found" : "Not Found");
console.log("ELEVENLABS_API_KEY:", process.env.ELEVENLABS_API_KEY ? "Found" : "Not Found");
