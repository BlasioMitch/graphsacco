import jwt from 'jsonwebtoken';
import { IncomingMessage } from 'http';

const JWT_SECRET  = process.env.INTERNAL_API_SECRET;

export const generateApiToken = () => {
    const payload = {
        service:'graphql',
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // 1 hour expiration
    }
    return jwt.sign(payload, JWT_SECRET as string)
}

export const verifyToken = (token: string) => {
    return jwt.verify(token, JWT_SECRET as string, (err, decoded) => {
        if (err) {
            throw new Error('Invalid token');
        }
        return decoded;
    });
}

export const getAuthTokenFromRequest = (req: IncomingMessage): string | null => {
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
        return authHeader.replace('Bearer ', '');
    }
    return null;
};

export const authenticateRequest = (req: IncomingMessage) => {
    const token = getAuthTokenFromRequest(req);
    if (!token) {
        throw new Error('Authentication required: Bearer token missing');
    }
    try {
        verifyToken(token);
    } catch (err) {
        throw new Error('Authentication failed: Invalid token');
    }
    return token;
};