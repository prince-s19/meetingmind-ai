import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const JEV_API_URL = 'https://api.typesafe.ai/v1/systemone';
const JEV_API_KEY = process.env.JEV_API_KEY;

export class JevAIService {
    /**
     * Extract action items from transcript using Jev AI
     * Returns: { actionItems, unclear, confidence scores }
     */
    static async extractActionItems(transcript, speakers = []) {
        try {
            // Build dynamic criteria for owner selection
            const ownerCriteria = speakers.length > 0
                ? speakers.reduce((acc, speaker) => ({ ...acc, [speaker]: speaker }), { 'Unclear': 'Unknown owner' })
                : { 'Speaker 1': 'First speaker', 'Speaker 2': 'Second speaker', 'Unknown': 'Owner not clear' };

            const response = await axios.post(
                JEV_API_URL,
                {
                    state: transcript,
                    model: 'jev-latest',
                    questions: {
                        has_action_items: {
                            type: 'noul',
                            instructions: 'Does this transcript contain action items or tasks?',
                        },
                        action_items_count: {
                            type: 'score',
                            instructions: 'How many distinct action items are mentioned?',
                            criteria: [
                                '0 items (pure discussion)',
                                '1-3 items',
                                '4-6 items',
                                '7+ items (high activity)',
                            ],
                        },
                    },
                },
                {
                    headers: {
                        'Authorization': `Bearer ${JEV_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            // Extract confidence and counts
            const hasItems = response.data.answers.has_action_items.noul;
            const itemCount = response.data.answers.action_items_count.score;

            return {
                success: true,
                hasActionItems: hasItems > 0.5,
                estimatedCount: Math.round(itemCount * 10),
                confidence: response.data.answers.has_action_items.confidence || 0.95,
                usage: response.data.usage,
            };
        } catch (error) {
            console.error('Jev AI Error:', error.response?.data || error.message);
            throw new Error(`Jev AI extraction failed: ${error.message}`);
        }
    }

    /**
     * Score owner clarity for each potential task
     */
    static async scoreOwnerClarity(task, speakers = []) {
        try {
            const ownerCriteria = speakers.reduce(
                (acc, speaker) => ({ ...acc, [speaker]: speaker }),
                { 'Unclear': 'No clear owner' }
            );

            const response = await axios.post(
                JEV_API_URL,
                {
                    state: task,
                    model: 'jev-latest',
                    questions: {
                        owner: {
                            type: 'choice',
                            instructions: 'Who is the owner of this task?',
                            criteria: ownerCriteria,
                        },
                        owner_confidence: {
                            type: 'score',
                            instructions: 'How confident are you about the owner?',
                            criteria: ['Not sure', 'Somewhat sure', 'Very sure'],
                        },
                    },
                },
                {
                    headers: {
                        'Authorization': `Bearer ${JEV_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            const answers = response.data.answers;
            return {
                owner: answers.owner.choice,
                ownerConfidence: answers.owner_confidence.score,
                ownerProbabilities: answers.owner.probabilities,
                needsClarification: answers.owner.confidence < 0.7,
            };
        } catch (error) {
            console.error('Jev AI Owner Scoring Error:', error.message);
            throw error;
        }
    }

    /**
     * Score deadline clarity
     */
    static async scoreDeadlineClarity(task) {
        try {
            const response = await axios.post(
                JEV_API_URL,
                {
                    state: task,
                    model: 'jev-latest',
                    questions: {
                        has_deadline: {
                            type: 'noul',
                            instructions: 'Is there a clear deadline mentioned?',
                        },
                        deadline_urgency: {
                            type: 'choice',
                            instructions: 'How urgent is this deadline?',
                            criteria: {
                                'ASAP': 'Urgent, needs immediate attention',
                                'This Week': 'Should be done this week',
                                'This Month': 'Should be done this month',
                                'No specific deadline': 'No deadline mentioned',
                            },
                        },
                    },
                },
                {
                    headers: {
                        'Authorization': `Bearer ${JEV_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            const answers = response.data.answers;
            return {
                hasDeadline: answers.has_deadline.noul > 0.5,
                urgency: answers.deadline_urgency.choice,
                urgencyConfidence: answers.deadline_urgency.confidence,
                needsClarification: answers.deadline_urgency.confidence < 0.7,
            };
        } catch (error) {
            console.error('Jev AI Deadline Scoring Error:', error.message);
            throw error;
        }
    }

    /**
     * Score overall task clarity (combines all dimensions)
     */
    static async scoreTaskClarity(task, speakers = []) {
        try {
            const [ownerResult, deadlineResult] = await Promise.all([
                this.scoreOwnerClarity(task, speakers),
                this.scoreDeadlineClarity(task),
            ]);

            return {
                ownerClarity: ownerResult,
                deadlineClarity: deadlineResult,
                needsClarification:
                    ownerResult.needsClarification || deadlineResult.needsClarification,
                overallConfidence:
                    (ownerResult.ownerConfidence + deadlineResult.urgencyConfidence) / 2,
            };
        } catch (error) {
            console.error('Task Clarity Scoring Error:', error.message);
            throw error;
        }
    }
}