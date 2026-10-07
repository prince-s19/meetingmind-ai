import express from 'express';
import axios from 'axios';
import { User } from '../models/User.js';
import { Meeting } from '../models/Meeting.js';
import { asyncHandler } from '../middleware/error-handler.js';
import { authenticate } from '../middleware/authenticate.js';
import { ObjectId } from 'mongodb';

const router = express.Router();

const GOOGLE_OAUTH_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_TASKS_API = 'https://www.googleapis.com/tasks/v1/lists/@default/tasks';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

/**
 * GET /api/google/status
 * Check if the user has valid Google OAuth tokens saved
 */
router.get(
    '/status',
    authenticate,
    asyncHandler(async (req, res) => {
        const userId = req.userId;
        const user = await User.findById(userId);

        if (!user || !user.googleTokens || !user.googleTokens.accessToken) {
            return res.json({ isAuthorized: false });
        }

        // Optional: Check if token is expired, but for now just presence is fine.
        // If it's expired, the frontend will hit a 401 when trying to sync, and can prompt to re-auth.
        const isExpired = user.googleTokens.expiresAt && Date.now() > user.googleTokens.expiresAt;
        
        res.json({ 
            isAuthorized: true,
            isExpired: isExpired // Frontend can use this to force re-auth if they want
        });
    })
);
/**
 * POST /api/google/oauth/authorize
 * Get authorization URL
 */
router.post(
    '/oauth/authorize',
    asyncHandler(async (req, res) => {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.append('client_id', process.env.GOOGLE_CLIENT_ID);
        authUrl.searchParams.append('redirect_uri', process.env.GOOGLE_REDIRECT_URL);
        authUrl.searchParams.append('response_type', 'code');
        authUrl.searchParams.append('scope', [
            'https://www.googleapis.com/auth/tasks',
            'https://www.googleapis.com/auth/calendar',
        ].join(' '));
        authUrl.searchParams.append('state', Buffer.from(userId).toString('base64'));
        authUrl.searchParams.append('access_type', 'offline');

        res.json({
            success: true,
            authUrl: authUrl.toString(),
            url: authUrl.toString(),
            redirectUrl: authUrl.toString(),
        });
    })
);

/**
 * GET /api/google/oauth/callback
 * Handle OAuth callback
 */
router.get(
    '/oauth/callback',
    asyncHandler(async (req, res) => {
        const { code, state } = req.query;

        if (!code || !state) {
            return res.status(400).json({ error: 'Missing code or state' });
        }

        const userId = Buffer.from(state, 'base64').toString();

        // Exchange code for tokens
        const tokenResponse = await axios.post(GOOGLE_OAUTH_URL, {
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: process.env.GOOGLE_REDIRECT_URL,
        });

        // Save tokens to user
        await User.updateTokens(userId, {
            accessToken: tokenResponse.data.access_token,
            refreshToken: tokenResponse.data.refresh_token,
            expiresAt: Date.now() + tokenResponse.data.expires_in * 1000,
        });

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${frontendUrl}/dashboard?oauth=success&userId=${userId}`);
    })
);

/**
 * POST /api/google/sync/:meetingId
 * Create tasks in Google Tasks and calendar events
 */
router.post(
    '/sync/:meetingId',
    authenticate,
    asyncHandler(async (req, res) => {
        const { meetingId } = req.params;
        const userId = req.userId;

        const meeting = await Meeting.findById(meetingId);
        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        const user = await User.findById(userId);
        if (!user || !user.googleTokens) {
            return res.status(401).json({
                error: 'Google not connected. Please authorize first.',
            });
        }

        const accessToken = user.googleTokens.accessToken;
        const { tasksToSync } = req.body;

        // Smart Assignment Logic
        let finalTasksToSync = [];

        if (tasksToSync && Array.isArray(tasksToSync)) {
            // User manually selected/edited tasks from the UI
            finalTasksToSync = tasksToSync;
        } else {
            // Auto-matching logic
            const userFirstName = user.name ? user.name.split(' ')[0].toLowerCase() : '';
            const userFullName = user.name ? user.name.toLowerCase() : '';

            finalTasksToSync = meeting.actionItems.filter(item => {
                const owner = (item.owner || '').toLowerCase();
                if (!owner || owner === 'unclear' || owner === 'unassigned') return false;
                
                return owner.includes(userFirstName) || owner.includes(userFullName);
            });

            // If no matches found, prompt manual selection on the frontend
            if (finalTasksToSync.length === 0) {
                return res.json({
                    success: false,
                    requiresManualSelection: true,
                    message: "We couldn't automatically find your tasks. Please select them manually.",
                    allTasks: meeting.actionItems
                });
            }
        }

        // Create tasks and events
        const results = [];
        for (const item of finalTasksToSync) {
            try {
                // Determine Deadline (Fallback to old logic if ISO doesn't exist)
                let dueString = item.deadlineISO || item.deadlineClarity?.deadline || undefined;
                let parsedDeadline = null;

                if (dueString) {
                    // Check if it's in DD-MM-YYYY format and convert to YYYY-MM-DD for native Date parsing
                    const ddMmYyyyMatch = dueString.match(/^(\d{2})-(\d{2})-(\d{4})$/);
                    if (ddMmYyyyMatch) {
                        const [_, day, month, year] = ddMmYyyyMatch;
                        dueString = `${year}-${month}-${day}`;
                    }

                    const tempDate = new Date(dueString);
                    if (!isNaN(tempDate.getTime())) {
                        parsedDeadline = tempDate;
                        
                        // Tasks API requires RFC 3339 timestamp, but heavily prefers time to be 00:00:00
                        const taskDate = new Date(tempDate);
                        taskDate.setUTCHours(0, 0, 0, 0);
                        dueString = taskDate.toISOString(); 
                    } else {
                        // If it's not a valid date string (e.g. "Monday"), don't pass it as 'due'
                        dueString = undefined;
                    }
                }
                
                // Create Google Task
                const taskResponse = await axios.post(
                    GOOGLE_TASKS_API,
                    {
                        title: item.task,
                        notes: `Owner: ${item.owner || 'Unclear'}\nPriority: ${item.priority}\nSource: MeetingMind AI`,
                        ...(dueString && { due: dueString }),
                    },
                    {
                        headers: { Authorization: `Bearer ${accessToken}` },
                    }
                );

                let eventLink = null;
                // Create calendar event if deadline is valid
                if (parsedDeadline) {
                    const deadline = parsedDeadline;
                    
                    // Determine reminder time. Default to 60 mins before if not provided.
                    let reminderMinutes = 60;
                    if (item.reminderISO) {
                        const reminderDate = new Date(item.reminderISO);
                        // Calculate diff in minutes
                        reminderMinutes = Math.round((deadline.getTime() - reminderDate.getTime()) / 60000);
                        if (reminderMinutes < 0) reminderMinutes = 60; // fallback just in case
                    }

                    const eventResponse = await axios.post(
                        GOOGLE_CALENDAR_API,
                        {
                            summary: `[TASK] ${item.task}`,
                            description: `Owner: ${item.owner || 'TBD'}\nSource: MeetingMind AI\n\n${item.reminderNote ? 'Reminder: ' + item.reminderNote : ''}`,
                            start: {
                                dateTime: deadline.toISOString(),
                                timeZone: 'UTC', // ISO string is in UTC
                            },
                            end: {
                                dateTime: new Date(deadline.getTime() + 60 * 60 * 1000).toISOString(),
                                timeZone: 'UTC',
                            },
                            reminders: {
                                useDefault: false,
                                overrides: [
                                    { method: 'popup', minutes: reminderMinutes },
                                ],
                            },
                        },
                        {
                            headers: { Authorization: `Bearer ${accessToken}` },
                        }
                    );
                    eventLink = eventResponse.data.htmlLink;
                }

                results.push({
                    task: item.task,
                    success: true,
                    googleTaskId: taskResponse.data.id,
                    calendarLink: eventLink,
                });
            } catch (error) {
                console.error('Failed to sync task:', error.message);
                results.push({
                    task: item.task,
                    success: false,
                    error: error.message,
                });
            }
        }

        // Mark individual action items as synced
        const updatedActionItems = meeting.actionItems.map(item => {
            const result = results.find(r => r.task === item.task);
            if (result && result.success) {
                return { 
                    ...item, 
                    syncedToGoogle: true, 
                    googleTaskId: result.googleTaskId,
                    calendarLink: result.calendarLink
                };
            }
            return item;
        });

        await Meeting.updateActionItems(meetingId, updatedActionItems);

        // Mark meeting as synced
        await Meeting.updateGoogleSync(meetingId, true);

        res.json({
            success: true,
            synced: results.filter((r) => r.success).length,
            failed: results.filter((r) => !r.success).length,
            results,
        });
    })
);

export default router;