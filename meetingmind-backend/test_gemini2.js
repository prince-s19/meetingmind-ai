import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

axios.get(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`
).then(r => console.log('MODELS:', r.data.models.map(m => m.name)))
.catch(e => console.error('ERROR:', e.response ? e.response.data : e.message));
