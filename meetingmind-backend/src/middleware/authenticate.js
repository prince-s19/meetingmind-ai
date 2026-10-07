import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

/**
 * JWT Authentication Middleware
 * Verifies the Bearer token and injects req.userId
 * 
 * Usage: router.get('/protected', authenticate, handler)
 */
export function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Access denied. No token provided.',
                hint: 'Include "Authorization: Bearer <token>" in your request headers.',
            });
        }

        const token = authHeader.split(' ')[1];

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        req.userEmail = decoded.email;

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Token expired. Please log in again.',
            });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                error: 'Invalid token. Please log in again.',
            });
        }
        return res.status(500).json({ error: 'Authentication failed.' });
    }
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(user) {
    return jwt.sign(
        {
            userId: user._id.toString(),
            email: user.email,
            name: user.name,
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
}
