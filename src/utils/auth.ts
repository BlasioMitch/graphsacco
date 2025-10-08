import jwt from 'jsonwebtoken';
import { IncomingMessage } from 'http';
import { Request } from 'express';
import { GraphQLError } from 'graphql';

const JWT_SECRET  = process.env.JWT_SECRET

// export const generateApiToken = () => {
//     const payload = {
//         service:'graphql',
//         exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // 1 hour expiration
//     }
//     return jwt.sign(payload, JWT_SECRET as string)
// }

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

export const extractTokenFromCookie = (req: Request): string | undefined => {
    // console.log(req.cookies,' cookies')
    if( !req.cookies || !req.cookies.token){
        return undefined;
    }
    return req.cookies.token;
}; 

export const requireAuth = (token: string | undefined) => {
    if(!token){
        throw new GraphQLError('Unauthorized: No token provided',{
            extensions: {
                code: 'UNAUTHORIZED',
            }
        });
    }
    return true;
}