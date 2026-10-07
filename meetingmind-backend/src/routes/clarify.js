import express from 'express';
import { Meeting } from '../models/Meeting.js';
import { JevAIService } from '../services/jev-ai.js';
import { GeminiService } from '../services/gemini.js';
import { asyncHandler } from '../middleware/error-handler.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();

/**
 * POST /api/clarify/:meetingId
 * Answer a clarification question for an action item
 */
router.post(
  '/:meetingId',
  authenticate,
  asyncHandler(async (req, res) => {
    const { meetingId } = req.params;
    const { taskIndex, answer } = req.body;

    if (!meetingId || taskIndex === undefined || !answer) {
      return res.status(400).json({
        error: 'meetingId, taskIndex, and answer are required',
      });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const actionItems = meeting.actionItems || [];
    if (taskIndex >= actionItems.length) {
      return res.status(400).json({ error: 'Invalid taskIndex' });
    }

    // Update the action item with the clarification answer
    actionItems[taskIndex] = {
      ...actionItems[taskIndex],
      clarificationAnswer: answer,
      needsClarification: false,
      updatedAt: new Date(),
    };

    await Meeting.updateActionItems(meetingId, actionItems);

    res.json({
      success: true,
      message: 'Clarification saved',
      actionItem: actionItems[taskIndex],
    });
  })
);

/**
 * GET /api/clarify/:meetingId
 * Get all action items that need clarification
 */
router.get(
  '/:meetingId',
  authenticate,
  asyncHandler(async (req, res) => {
    const { meetingId } = req.params;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const clarificationNeeded = (meeting.actionItems || [])
      .map((item, index) => ({ ...item, index }))
      .filter((item) => item.needsClarification);

    res.json({
      success: true,
      clarificationNeeded,
      count: clarificationNeeded.length,
    });
  })
);

export default router;
