import express from 'express';
import multer from 'multer';
import { Meeting } from '../models/Meeting.js';
import { User } from '../models/User.js';
import { FileHandler } from '../services/file-handler.js';
import { JevAIService } from '../services/jev-ai.js';
import { GeminiService } from '../services/gemini.js';
import { asyncHandler } from '../middleware/error-handler.js';
import { validateInput, fileUploadSchema } from '../middleware/validation.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        const allowed = ['application/pdf', 'text/plain'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF and TXT files are allowed'));
        }
    },
});

/**
 * POST /api/upload
 * Upload and process meeting transcript
 */
router.post(
    '/',
    authenticate,
    upload.single('file'),
    asyncHandler(async (req, res) => {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const userId = req.userId; // Extracted from JWT token
        const { userPrompt } = req.body;
        
        // Verify user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Validate file
        const fileValidation = fileUploadSchema.validate({
            fileName: req.file.originalname,
            fileType: req.file.originalname.split('.').pop(),
            fileSize: req.file.size,
        });

        if (fileValidation.error) {
            return res.status(400).json({ error: fileValidation.error.message });
        }

        // Process file
        const processed = await FileHandler.processFile(
            req.file.buffer,
            req.file.originalname
        );

        // Create meeting record
        const meeting = await Meeting.create({
            userId,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            fileStoragePath: await FileHandler.storeFile(
                processed.encryptedText,
                req.file.originalname
            ),
            fileHash: processed.fileHash,
            transcript: processed.originalText,
            userPrompt: userPrompt || null,
        });

        // Start extraction in background
        extractAndSummarize(meeting.insertedId.toString(), processed, userPrompt);

        res.json({
            success: true,
            meetingId: meeting.insertedId,
            status: 'processing',
            speakers: processed.speakers,
            wordCount: processed.wordCount,
            hasUserPrompt: !!userPrompt,
        });
    })
);

/**
 * Background task: Extract and summarize
 */
async function extractAndSummarize(meetingId, processed, userPrompt = null) {
    console.log(`🔄 Starting extraction for meeting ${meetingId}...`);

    try {
        // Single Gemini call to get both tasks and summary (faster, less rate-limit risk)
        const { meetingTitle, meetingDate, tasks, summary } = await GeminiService.extractTasksAndSummary(processed.originalText);

        console.log(`📋 Extracted ${tasks.length} tasks for meeting ${meetingId} ("${meetingTitle}")`);

        // Always update DB to unblock the UI
        await Meeting.updateMetadata(meetingId, meetingTitle, meetingDate);
        await Meeting.updateExtracted(meetingId, tasks);
        await Meeting.updateSummary(meetingId, summary);

        // If user provided a custom prompt, run AI analysis on it too
        if (userPrompt) {
            const promptResult = await GeminiService.analyzeWithPrompt(
                processed.originalText,
                userPrompt
            );
            await Meeting.updateAIResponse(meetingId, userPrompt, promptResult.response);
            console.log(`✅ Extraction + custom prompt complete for meeting ${meetingId}`);
        } else {
            console.log(`✅ Extraction complete for meeting ${meetingId}`);
        }
    } catch (error) {
        console.error(`❌ Extraction failed for meeting ${meetingId}:`, error.message);
        // Still mark it as ready so UI doesn't get stuck
        await Meeting.updateExtracted(meetingId, []).catch(() => {});
        await Meeting.updateSummary(meetingId, 'Processing failed. Please try uploading again.').catch(() => {});
    }
}

export default router;