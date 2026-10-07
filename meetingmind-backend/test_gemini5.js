import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${GEMINI_API_KEY}`,
    {
        contents: [{ parts: [{ text: 'Hello' }] }]
    }
).then(r => console.log('SUCCESS:', r.data.candidates[0].content.parts[0].text))
.catch(e => console.error('ERROR:', e.response ? e.response.data : e.message));
