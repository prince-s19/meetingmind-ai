import { db } from '../server.js';
import { ObjectId } from 'mongodb';

export class User {
    static async create(userData) {
        const result = await db.collection('users').insertOne({
            email: userData.email,
            name: userData.name,
            password: userData.password || null, // hashed password (null for Google sign-in users)
            authProvider: userData.authProvider || 'local', // 'local' or 'google'
            googleId: userData.googleId || null,
            profilePicture: userData.profilePicture || null,
            googleTokens: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        return result;
    }

    static async findById(id) {
        return await db.collection('users').findOne({ _id: new ObjectId(id) });
    }

    static async findByEmail(email) {
        return await db.collection('users').findOne({ email });
    }

    static async findByGoogleId(googleId) {
        return await db.collection('users').findOne({ googleId });
    }

    static async updateTokens(userId, tokens) {
        return await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: { googleTokens: tokens, updatedAt: new Date() } }
        );
    }

    static async updateGoogleId(userId, googleId, profilePicture) {
        return await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            {
                $set: {
                    googleId,
                    profilePicture: profilePicture || null,
                    updatedAt: new Date(),
                },
            }
        );
    }
}