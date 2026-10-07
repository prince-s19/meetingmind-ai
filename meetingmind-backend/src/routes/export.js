import express from 'express';
import PDFDocument from 'pdfkit';
import { Meeting } from '../models/Meeting.js';
import { authenticate } from '../middleware/authenticate.js';
import { asyncHandler } from '../middleware/error-handler.js';

const router = express.Router();

// Helper to format dates for Google Calendar (YYYYMMDDTHHmmssZ)
function formatGoogleDate(isoString) {
    if (!isoString) return '';
    return isoString.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * GET /api/export/:id/pdf
 * Generate a PDF of the meeting tasks
 */
router.get(
    '/:id/pdf',
    authenticate,
    asyncHandler(async (req, res) => {
        const meeting = await Meeting.findById(req.params.id);
        
        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }
        
        // Ensure the user owns this meeting
        if (meeting.userId.toString() !== req.userId) {
            return res.status(403).json({ error: 'Unauthorized access to this meeting' });
        }

        const title = meeting.meetingTitle || 'Meeting Tasks';
        const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        
        // Set response headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}_tasks.pdf"`);

        // Initialize PDF document
        const doc = new PDFDocument({ margin: 50 });
        doc.pipe(res);

        // --- HEADER ---
        doc.fontSize(24).font('Helvetica-Bold').text(title, { align: 'center' });
        doc.moveDown(0.5);
        
        doc.fontSize(12).font('Helvetica').fillColor('gray')
           .text(`Date & Time: ${meeting.meetingDate || 'Unknown Date'}`, { align: 'center' });
        doc.moveDown(2);

        // --- TASKS ---
        if (!meeting.actionItems || meeting.actionItems.length === 0) {
            doc.fontSize(14).fillColor('black').text('No action items found for this meeting.', { align: 'center' });
        } else {
            // Group tasks by owner
            const tasksByOwner = {};
            meeting.actionItems.forEach(item => {
                const owner = item.owner || 'Unassigned';
                if (!tasksByOwner[owner]) tasksByOwner[owner] = [];
                tasksByOwner[owner].push(item);
            });

            for (const [owner, tasks] of Object.entries(tasksByOwner)) {
                // Owner Header
                doc.fontSize(16).font('Helvetica-Bold').fillColor('#4A90E2').text(owner);
                doc.moveDown(0.5);

                tasks.forEach((task, index) => {
                    doc.fontSize(12).font('Helvetica-Bold').fillColor('black').text(`Task ${index + 1}: `, { continued: true });
                    doc.font('Helvetica').text(task.task);
                    
                    if (task.deadline && task.deadline !== "No specific deadline") {
                        doc.font('Helvetica-Oblique').fillColor('#666666').text(`Deadline: ${task.deadline}`);
                    }
                    if (task.reminderNote) {
                        doc.font('Helvetica-Oblique').fillColor('#888888').text(`Reminder: ${task.reminderNote}`);
                    }

                    // Generate Google Calendar / Tasks Link
                    if (task.deadlineISO) {
                        const startDate = formatGoogleDate(task.deadlineISO);
                        // Make it a 1 hour event by default
                        const endDateObj = new Date(new Date(task.deadlineISO).getTime() + 60 * 60 * 1000);
                        const endDate = formatGoogleDate(endDateObj.toISOString());
                        
                        const gCalLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(task.task)}&dates=${startDate}/${endDate}&details=${encodeURIComponent("Meeting: " + title)}`;
                        
                        doc.moveDown(0.3);
                        doc.fontSize(10).font('Helvetica').fillColor('blue')
                           .text('[+] Add to Google Calendar / Tasks', {
                               link: gCalLink,
                               underline: true
                           });
                    }
                    
                    doc.moveDown(1);
                });
                
                doc.moveDown(1);
            }
        }

        // Finalize PDF
        doc.end();
    })
);

export default router;
