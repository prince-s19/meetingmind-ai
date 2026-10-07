import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const JEV_API_URL = 'https://api.typesafe.ai/v1/systemone';
const JEV_API_KEY = process.env.JEV_API_KEY;

axios.post(
    JEV_API_URL,
    {
        state: 'We should meet tomorrow.',
        model: 'jev-latest',
        questions: {
            has_action_items: {
                type: 'noul',
                instructions: 'Does this transcript contain action items or tasks?',
            },
        },
    },
    {
        headers: {
            'Authorization': `Bearer ${JEV_API_KEY}`,
            'Content-Type': 'application/json',
        },
    }
).then(r => console.log('JEV_SUCCESS:', r.data))
.catch(e => console.error('JEV_ERROR:', e.response ? e.response.data : e.message));
