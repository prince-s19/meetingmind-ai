import express from 'express';
import { Meeting } from '../models/Meeting.js';
import { JevAIService } from '../services/jev-ai.js';
import { asyncHandler } from '../middleware/error-handler.js';
import { ObjectId } from 'mongodb';
import { authenticate } from '../middleware/authenticate.js';
import { calculateConcreteDeadline } from '../utils/dateParser.js';
const router = express.Router();

/**
 * POST /api/extract/:meetingId
 * Get detailed extraction with task clarity scoring
 */
router.post(
    '/:meetingId',
    authenticate,
    asyncHandler(async (req, res) => {
        const { meetingId } = req.params;
        const userId = req.userId;
        const { actionItems, speakers } = req.body;

        if (!meetingId || !actionItems) {
            return res.status(400).json({
                error: 'meetingId and actionItems required',
            });
        }

        const meeting = await Meeting.findById(meetingId);
        if (!meeting || meeting.userId.toString() !== userId) {
            return res.status(403).json({ error: 'You do not have access to this meeting' });
        }

        // Score clarity for each action item
        const scoredItems = [];
        for (const item of actionItems) {
            try {
                const clarity = await JevAIService.scoreTaskClarity(item.task, speakers);
                // Prefer user-provided deadline string if Jev AI didn't find one in the task text
                let urgencyToParse = clarity.deadlineClarity?.urgency;
                if (item.deadline && urgencyToParse === 'No specific deadline') {
                    urgencyToParse = item.deadline;
                }
                
                // Parse abstract urgency into a concrete Date object
                const concreteDeadline = calculateConcreteDeadline(urgencyToParse);

                scoredItems.push({
                    ...item,
                    ...clarity,
                    concreteDeadline,
                    needsClarification: clarity.needsClarification,
                });
            } catch (error) {
                console.error('Error scoring task:', error);
                scoredItems.push({
                    ...item,
                    error: error.message,
                    needsClarification: true,
                });
            }
        }

        // Update meeting
        await Meeting.updateActionItems(meetingId, scoredItems);

        // Filter items that need clarification
        const clarificationNeeded = scoredItems.filter(
            (item) => item.needsClarification
        );

        res.json({
            success: true,
            actionItems: scoredItems,
            clarificationNeeded,
            readyItems: scoredItems.filter((item) => !item.needsClarification)
                .length,
        });
    })
);

/**
 * GET /api/extract/:meetingId
 * Get extraction status
 */
router.get(
    '/:meetingId',
    authenticate,
    asyncHandler(async (req, res) => {
        const { meetingId } = req.params;
        const userId = req.userId;

        const meeting = await Meeting.findById(meetingId);
        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }
        
        if (meeting.userId.toString() !== userId) {
            return res.status(403).json({ error: 'You do not have access to this meeting' });
        }

        res.json({
            success: true,
            status: meeting.status,
            extracted: meeting.extracted,
            actionItems: meeting.actionItems,
            summary: meeting.summary,
        });
    })
);

/**
 * PATCH /api/extract/:meetingId/tasks/:taskIndex
 * Update a specific task (status, owner, deadline, etc)
 */
router.patch(
    '/:meetingId/tasks/:taskIndex',
    authenticate,
    asyncHandler(async (req, res) => {
        const { meetingId, taskIndex } = req.params;
        const userId = req.userId;
        const updates = req.body;

        const meeting = await Meeting.findById(meetingId);
        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }
        
        if (meeting.userId.toString() !== userId) {
            return res.status(403).json({ error: 'You do not have access to this meeting' });
        }

        try {
            await Meeting.updateSingleTask(meetingId, parseInt(taskIndex), updates);
            res.json({ success: true, message: 'Task updated successfully' });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    })
);

/**
 * DELETE /api/extract/:meetingId/tasks/:taskIndex
 * Delete a specific task
 */
router.delete(
    '/:meetingId/tasks/:taskIndex',
    authenticate,
    asyncHandler(async (req, res) => {
        const { meetingId, taskIndex } = req.params;
        const userId = req.userId;

        const meeting = await Meeting.findById(meetingId);
        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }
        
        if (meeting.userId.toString() !== userId) {
            return res.status(403).json({ error: 'You do not have access to this meeting' });
        }

        try {
            await Meeting.deleteSingleTask(meetingId, parseInt(taskIndex));
            res.json({ success: true, message: 'Task deleted successfully' });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    })
);

export default router;