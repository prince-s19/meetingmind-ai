import express from 'express';
import { Meeting } from '../models/Meeting.js';
import { asyncHandler } from '../middleware/error-handler.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();

/**
 * GET /api/dashboard/meetings
 * Get all meetings for a user
 */
router.get(
    '/meetings',
    authenticate,
    asyncHandler(async (req, res) => {
        const userId = req.userId;
        const { limit = 20, skip = 0 } = req.query;

        const meetings = await Meeting.findByUserId(
            userId,
            parseInt(limit),
            parseInt(skip)
        );

        res.json({
            success: true,
            meetings: meetings.map((m) => ({
                id: m._id,
                fileName: m.fileName,
                createdAt: m.createdAt,
                status: m.status,
                taskCount: m.actionItems?.length || 0,
                summary: m.summary?.substring(0, 100),
            })),
            count: meetings.length,
        });
    })
);

/**
 * GET /api/dashboard/stats
 * Get user statistics
 */
router.get(
    '/stats',
    authenticate,
    asyncHandler(async (req, res) => {
        const userId = req.userId;

        const meetings = await Meeting.findByUserId(userId, 1000, 0);

        const stats = {
            totalMeetings: meetings.length,
            totalTasks: meetings.reduce((sum, m) => sum + (m.actionItems?.length || 0), 0),
            completedTasks: meetings.reduce((sum, m) => sum + (m.actionItems?.filter(item => item.status === 'completed').length || 0), 0),
            syncedMeetings: meetings.filter((m) => m.googleTasksCreated).length,
            avgTasksPerMeeting:
                meetings.length > 0
                    ? Math.round(
                        meetings.reduce((sum, m) => sum + (m.actionItems?.length || 0), 0) /
                        meetings.length
                    )
                    : 0,
        };

        res.json({ success: true, stats });
    })
);

/**
 * DELETE /api/dashboard/:meetingId
 * Delete an entire meeting and its tasks
 */
router.delete(
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

        await Meeting.deleteMeeting(meetingId);

        // Note: You could also delete the physical file here via FileHandler
        // if you want to clean up storage, but for now we just remove DB record.

        res.json({ success: true, message: 'Meeting deleted successfully' });
    })
);

export default router;