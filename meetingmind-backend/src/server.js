import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { fileURLToPath } from 'url';
import path from 'path';

// Import routes
import authRoutes from './routes/auth.js';
import uploadRoutes from './routes/upload.js';
import extractRoutes from './routes/extract.js';
import clarifyRoutes from './routes/clarify.js';
import googleSyncRoutes from './routes/google-sync.js';
import dashboardRoutes from './routes/dashboard.js';
import chatRoutes from './routes/chat.js';
import exportRoutes from './routes/export.js';

// Import middleware
import { apiLimiter, uploadLimiter } from './middleware/security.js';
import { errorHandler } from './middleware/error-handler.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Global MongoDB connection (we'll set this up in services)
export let db = null;

// Security middleware
app.use(helmet());

// Read FRONTEND_URL and sanitize any accidental invisible characters (like carriage returns)
const frontendUrl = process.env.FRONTEND_URL 
    ? process.env.FRONTEND_URL.trim() 
    : 'http://localhost:3000';

app.use(cors({
    origin: [
        frontendUrl, 
        'http://127.0.0.1:3000', 
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:3003'
    ],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Rate limiting
app.use('/api/', apiLimiter);
app.use('/api/upload', uploadLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/extract', extractRoutes);
app.use('/api/clarify', clarifyRoutes);
app.use('/api/google', googleSyncRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/export', exportRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handler (must be last)
app.use(errorHandler);

// Connect to MongoDB and start server
async function startServer() {
    try {
        const mongoClient = new MongoClient(process.env.MONGODB_URI);
        await mongoClient.connect();
        db = mongoClient.db('meetingmind');

        // Create indexes
        await db.collection('users').createIndex({ email: 1 }, { unique: true });
        await db.collection('meetings').createIndex({ userId: 1, createdAt: -1 });

        console.log('✅ Connected to MongoDB');

        app.listen(PORT, () => {
            console.log(`✅ Server running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();