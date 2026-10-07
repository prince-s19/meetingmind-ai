import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
        contents: [{ parts: [{ text: 'Hello' }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 200 }
    }
).then(r => console.log('SUCCESS:', r.data))
.catch(e => console.error('ERROR:', e.response ? e.response.data : e.message));
