import { db } from '../server.js';
import { ObjectId } from 'mongodb';

export class Meeting {
    static async create(meetingData) {
        const result = await db.collection('meetings').insertOne({
            userId: new ObjectId(meetingData.userId),
            fileName: meetingData.fileName,
            fileSize: meetingData.fileSize,
            fileStoragePath: meetingData.fileStoragePath,
            fileHash: meetingData.fileHash,
            transcript: meetingData.transcript,
            userPrompt: meetingData.userPrompt || null,
            aiResponse: null,
            extracted: null,
            actionItems: [],
            summary: null,
            chatHistory: [],
            googleTasksCreated: false,
            googleCalendarSynced: false,
            status: 'processing', // processing, ready, synced, archived
            createdAt: new Date(),
            updatedAt: new Date(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        });
        return result;
    }

    static async findById(id) {
        if (!ObjectId.isValid(id)) return null;
        return await db.collection('meetings').findOne({ _id: new ObjectId(id) });
    }

    static async updateExtracted(id, extracted) {
        return await db.collection('meetings').updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    extracted,
                    actionItems: extracted.map(item => ({
                        ...item,
                        status: item.status || 'open',
                        needsClarification: false
                    })),
                    status: 'ready',
                    updatedAt: new Date()
                }
            }
        );
    }

    static async updateActionItems(id, items) {
        // Ensure all items have a status
        const itemsWithStatus = items.map(item => ({
            ...item,
            status: item.status || 'pending'
        }));

        return await db.collection('meetings').updateOne(
            { _id: new ObjectId(id) },
            { $set: { actionItems: itemsWithStatus, updatedAt: new Date() } }
        );
    }

    static async updateSummary(id, summary) {
        return await db.collection('meetings').updateOne(
            { _id: new ObjectId(id) },
            { $set: { summary, updatedAt: new Date() } }
        );
    }

    static async updateMetadata(id, meetingTitle, meetingDate) {
        return await db.collection('meetings').updateOne(
            { _id: new ObjectId(id) },
            { $set: { meetingTitle, meetingDate, updatedAt: new Date() } }
        );
    }

    static async findByUserId(userId, limit = 20, skip = 0) {
        return await db.collection('meetings')
            .find({ userId: new ObjectId(userId) })
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip)
            .toArray();
    }

    static async updateGoogleSync(id, synced = true) {
        return await db.collection('meetings').updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    googleTasksCreated: synced,
                    googleCalendarSynced: synced,
                    status: synced ? 'synced' : 'ready',
                    updatedAt: new Date()
                }
            }
        );
    }

    static async updateAIResponse(id, userPrompt, aiResponse) {
        return await db.collection('meetings').updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    userPrompt,
                    aiResponse,
                    updatedAt: new Date()
                }
            }
        );
    }

    static async addChatEntry(id, entry) {
        return await db.collection('meetings').updateOne(
            { _id: new ObjectId(id) },
            {
                $push: {
                    chatHistory: {
                        prompt: entry.prompt,
                        response: entry.response,
                        usage: entry.usage || null,
                        timestamp: new Date()
                    }
                },
                $set: { updatedAt: new Date() }
            }
        );
    }

    static async deleteMeeting(id) {
        return await db.collection('meetings').deleteOne({ _id: new ObjectId(id) });
    }

    static async updateSingleTask(id, taskIndex, updates) {
        const meeting = await this.findById(id);
        if (!meeting || !meeting.actionItems || meeting.actionItems.length <= taskIndex) {
            throw new Error('Task not found');
        }

        const updatedItems = [...meeting.actionItems];
        updatedItems[taskIndex] = {
            ...updatedItems[taskIndex],
            ...updates,
            updatedAt: new Date()
        };

        return await this.updateActionItems(id, updatedItems);
    }

    static async deleteSingleTask(id, taskIndex) {
        const meeting = await this.findById(id);
        if (!meeting || !meeting.actionItems || meeting.actionItems.length <= taskIndex) {
            throw new Error('Task not found');
        }

        const updatedItems = [...meeting.actionItems];
        updatedItems.splice(taskIndex, 1);

        return await this.updateActionItems(id, updatedItems);
    }
}