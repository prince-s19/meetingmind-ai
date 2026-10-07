import express from 'express';
import { Meeting } from '../models/Meeting.js';
import { GeminiService } from '../services/gemini.js';
import { asyncHandler } from '../middleware/error-handler.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();

/**
 * POST /api/chat/:meetingId
 * Send a follow-up question about an existing meeting transcript
 */
router.post(
    '/:meetingId',
    authenticate,
    asyncHandler(async (req, res) => {
        const { meetingId } = req.params;
        const userId = req.userId;
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'prompt is required' });
        }

        // Fetch the meeting
        const meeting = await Meeting.findById(meetingId);
        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        // Verify the meeting belongs to this user
        if (meeting.userId.toString() !== userId) {
            return res.status(403).json({ error: 'You do not have access to this meeting' });
        }

        // Check transcript exists
        if (!meeting.transcript) {
            return res.status(400).json({ error: 'No transcript available for this meeting' });
        }

        // Send transcript + user prompt to Gemini
        const result = await GeminiService.analyzeWithPrompt(
            meeting.transcript,
            prompt
        );

        // Save to chat history
        await Meeting.addChatEntry(meetingId, {
            prompt,
            response: result.response,
            usage: result.usage,
        });

        res.json({
            success: true,
            meetingId,
            prompt,
            response: result.response,
            usage: result.usage,
        });
    })
);

/**
 * GET /api/chat/:meetingId/history
 * Get all past questions & AI responses for a meeting
 */
router.get(
    '/:meetingId/history',
    authenticate,
    asyncHandler(async (req, res) => {
        const { meetingId } = req.params;
        const userId = req.userId;

        const meeting = await Meeting.findById(meetingId);
        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        // Verify the meeting belongs to this user
        if (meeting.userId.toString() !== userId) {
            return res.status(403).json({ error: 'You do not have access to this meeting' });
        }

        res.json({
            success: true,
            meetingId,
            fileName: meeting.fileName,
            chatHistory: meeting.chatHistory || [],
            totalQuestions: (meeting.chatHistory || []).length,
        });
    })
);

export default router;
