import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);

import dotenv from 'dotenv';
dotenv.config();

async function listModels() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await response.json();
        const models = data.models.map(m => m.name);
        console.log("AVAILABLE MODELS:", models.filter(n => n.includes('gemini')));
    } catch(e) {
        console.error("Error fetching:", e);
    }
}
listModels();
