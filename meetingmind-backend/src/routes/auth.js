import express from 'express';
import bcrypt from 'bcrypt';
import axios from 'axios';
import { User } from '../models/User.js';
import { asyncHandler } from '../middleware/error-handler.js';
import { generateToken } from '../middleware/authenticate.js';

const router = express.Router();

const SALT_ROUNDS = 12;

/**
 * POST /api/auth/register
 * Register with email, name, and password
 */
router.post(
    '/register',
    asyncHandler(async (req, res) => {
        const { email, name, password } = req.body;

        if (!email || !name || !password) {
            return res.status(400).json({ error: 'email, name, and password are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Check if user exists
        const existing = await User.findByEmail(email);
        if (existing) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // Create user
        const result = await User.create({
            email,
            name,
            password: hashedPassword,
            authProvider: 'local',
        });

        // Get full user for token generation
        const user = await User.findById(result.insertedId);

        // Generate JWT token
        const token = generateToken(user);

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                authProvider: user.authProvider,
            },
            message: 'Registration successful',
        });
    })
);

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post(
    '/login',
    asyncHandler(async (req, res) => {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'email and password are required' });
        }

        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // If user signed up with Google and has no password
        if (!user.password && user.authProvider === 'google') {
            return res.status(400).json({
                error: 'This account was created with Google Sign-In. Please use Google to log in.',
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate JWT token
        const token = generateToken(user);

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                authProvider: user.authProvider,
                profilePicture: user.profilePicture,
            },
        });
    })
);

/**
 * POST /api/auth/google
 * Sign in with Google (exchange auth code for user info)
 */
router.post(
    '/google',
    asyncHandler(async (req, res) => {
        const { code, redirect_uri } = req.body;

        if (!code) {
            return res.status(400).json({ error: 'Google auth code is required' });
        }

        // Exchange code for tokens
        const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            // Google requires the exact same redirect_uri used to get the code.
            // For popup flows it's usually 'postmessage', for redirect flows it's the frontend URL.
            redirect_uri: redirect_uri || 'postmessage',
        });

        const { access_token, id_token } = tokenResponse.data;

        // Get user info from Google
        const userInfoResponse = await axios.get(
            'https://www.googleapis.com/oauth2/v2/userinfo',
            { headers: { Authorization: `Bearer ${access_token}` } }
        );

        const googleUser = userInfoResponse.data;
        // googleUser: { id, email, name, picture, verified_email }

        let user = null;
        let isNewUser = false;

        // Check if user exists by Google ID
        user = await User.findByGoogleId(googleUser.id);

        if (!user) {
            // Check if user exists by email (they registered with email/password before)
            user = await User.findByEmail(googleUser.email);

            if (user) {
                // Link Google account to existing user
                await User.updateGoogleId(user._id, googleUser.id, googleUser.picture);
                user.googleId = googleUser.id;
                user.profilePicture = googleUser.picture;
            } else {
                // Create new user via Google
                const result = await User.create({
                    email: googleUser.email,
                    name: googleUser.name,
                    password: null,
                    authProvider: 'google',
                    googleId: googleUser.id,
                    profilePicture: googleUser.picture,
                });
                user = await User.findById(result.insertedId);
                isNewUser = true;
            }
        }

        // Save Google tokens for Calendar/Tasks sync
        await User.updateTokens(user._id, {
            accessToken: access_token,
            refreshToken: tokenResponse.data.refresh_token || null,
            expiresAt: Date.now() + (tokenResponse.data.expires_in * 1000),
        });

        // Generate JWT token
        const token = generateToken(user);

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                email: user.email || googleUser.email,
                name: user.name || googleUser.name,
                profilePicture: user.profilePicture || googleUser.picture,
                authProvider: user.authProvider || 'google',
            },
            isNewUser,
        });
    })
);

export default router;