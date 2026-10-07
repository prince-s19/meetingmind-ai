import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const FALLBACK_MODELS = [
    'gemini-3.5-flash-lite', // Try fastest/cheapest first
    'gemini-3.5-flash',      // Fallback 1
    'gemini-3.6-flash'       // Fallback 2
];
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function geminiPost(body, retriesPerModel = 3) {
    let lastError = null;

    for (const model of FALLBACK_MODELS) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
        
        for (let attempt = 1; attempt <= retriesPerModel; attempt++) {
            try {
                const response = await axios.post(
                    `${url}?key=${GEMINI_API_KEY}`,
                    body,
                    { timeout: 60000 }
                );
                // If successful, log which model worked and return data
                console.log(`✅ Successfully generated content using ${model}`);
                return response;
            } catch (error) {
                lastError = error;
                const status = error.response?.status;

                // 429 = API Quota Reached. Changing models won't help, so we wait and retry.
                if (status === 429) {
                    if (attempt < retriesPerModel) {
                        console.warn(`⚠️ Gemini 429 Quota limit on ${model}, waiting 15s (attempt ${attempt}/${retriesPerModel})...`);
                        await new Promise(r => setTimeout(r, 15000));
                        continue; 
                    } else {
                        throw error; // Completely out of quota retries, fail fast
                    }
                }

                // 503 (Overloaded) or Timeout.
                if (status === 503 || error.code === 'ECONNABORTED') {
                    if (attempt < retriesPerModel) {
                        console.warn(`⚠️ Gemini ${status || 'TIMEOUT'} on ${model}, waiting 5s to retry same model (attempt ${attempt}/${retriesPerModel})...`);
                        await new Promise(r => setTimeout(r, 5000));
                        continue;
                    } else {
                        console.warn(`❌ Exhausted retries for ${model}. Cascading to next fallback model...`);
                        break; // Break inner loop to move to the next model
                    }
                }

                // 404 (Deprecated model) -> Don't bother retrying, immediately go to next model
                if (status === 404) {
                    console.warn(`⚠️ Gemini 404 on ${model}. Model is deprecated. Cascading to next fallback model...`);
                    break;
                }

                // Any other error (e.g., 400 Bad Request), throw immediately
                throw error;
            }
        }
    }

    // If we exhausted all fallback models, throw the final error
    throw lastError;
}

export class GeminiService {
    /**
     * Extract tasks AND generate summary in a single API call
     */
    static async extractTasksAndSummary(transcript) {
        try {
            const response = await geminiPost({
                contents: [
                    {
                        parts: [
                            {
                                text: `Analyze this meeting transcript and return a valid JSON object (no markdown, no backticks) with exactly four keys:

1. "meetingTitle": A short, descriptive name for the meeting (e.g., "Q3 Marketing Sync").
2. "meetingDate": The date and time of the meeting inferred from context, or "Unknown" if not mentioned.
3. "summary": A 2-3 sentence summary of the key points and decisions.
4. "tasks": An array of action item objects, each with:
   - "task": string (the action item)
   - "owner": string (the assigned person's name, or "Unclear")
   - "deadline": string (the human-readable deadline, e.g. "Next Friday", or "No specific deadline")
   - "deadlineISO": string or null (If a deadline/time is mentioned, an ISO 8601 datetime string. If only a date is mentioned, assume 17:00:00Z. If no deadline, leave null)
   - "reminderISO": string or null (If deadlineISO exists, calculate an ISO datetime string for exactly 1 hour before the deadlineISO. Leave null otherwise)
   - "reminderNote": string (A short 3-5 word reminder note, e.g. "Prepare slides for sync")
   - "priority": string ("HIGH", "MEDIUM", or "LOW")
   - "status": string (always "open")

If there are no tasks, return an empty array for "tasks".

Transcript:
${transcript}`,
                            },
                        ],
                    },
                ],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 1500,
                },
            });

            let text = response.data.candidates[0].content.parts[0].text.trim();
            // Strip markdown code fences if present
            text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

            const parsed = JSON.parse(text);
            return {
                meetingTitle: parsed.meetingTitle || 'Untitled Meeting',
                meetingDate: parsed.meetingDate || 'Unknown Date',
                tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
                summary: parsed.summary || 'No summary available.',
            };
        } catch (error) {
            console.error('Gemini extractTasksAndSummary Error:', error.response?.data || error.message);
            const status = error.response?.status;
            let errorMessage = 'No summary could be generated.';
            if (status === 429) {
                errorMessage = 'API Token Limit Reached. Please update your API key in the settings or .env file.';
            } else if (status === 503) {
                errorMessage = 'Google Gemini AI is currently experiencing high demand. Please try uploading again in a few minutes.';
            }
            return { tasks: [], summary: errorMessage };
        }
    }

    /**
     * Analyze transcript with a custom user prompt
     */
    static async analyzeWithPrompt(transcript, userPrompt) {
        try {
            const response = await geminiPost({
                contents: [
                    {
                        parts: [
                            {
                                text: `You are MeetingMind AI. Analyze the TRANSCRIPT and answer the USER'S QUESTION.

--- TRANSCRIPT ---
${transcript}
--- END TRANSCRIPT ---

--- USER'S QUESTION ---
${userPrompt}
--- END USER'S QUESTION ---

Answer clearly and professionally based strictly on the transcript.`,
                            },
                        ],
                    },
                ],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1000,
                },
            });

            const aiResponse = response.data.candidates[0].content.parts[0].text;
            return {
                success: true,
                response: aiResponse,
                promptType: 'user_query',
                usage: {
                    input_tokens: response.data.usageMetadata?.promptTokenCount || 0,
                    output_tokens: response.data.usageMetadata?.candidatesTokenCount || 0,
                },
            };
        } catch (error) {
            console.error('Gemini Prompt Analysis Error:', error.response?.data || error.message);
            throw new Error(`Gemini prompt analysis failed: ${error.message}`);
        }
    }

    /**
     * Generate clarification question for ambiguous task
     */
    static async generateClarificationQuestion(task, ambiguity) {
        try {
            const response = await geminiPost({
                contents: [
                    {
                        parts: [
                            {
                                text: `Generate a single, friendly clarification question (max 1 sentence) to resolve this ambiguity:\n\nTask: "${task}"\nAmbiguity: "${ambiguity}"\n\nQuestion:`,
                            },
                        ],
                    },
                ],
                generationConfig: {
                    temperature: 0.5,
                    maxOutputTokens: 50,
                },
            });

            const question = response.data.candidates[0].content.parts[0].text.trim();
            return { success: true, question };
        } catch (error) {
            console.error('Gemini Clarification Error:', error.message);
            throw error;
        }
    }
}