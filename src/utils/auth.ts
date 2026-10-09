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
    if (!JWT_SECRET) {
        throw new Error('JWT_SECRET is not configured');
    }
    try {
        // Must be the same secret saccoback uses to sign tokens
        return jwt.verify(token, JWT_SECRET);
    } catch {
        throw new Error('Invalid token');
    }
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
    try {
        // The signed payload identifies the caller: { userId, email, role }
        return verifyToken(token) as AuthPayload;
    } catch {
        throw new GraphQLError('Unauthorized: Invalid or expired token',{
            extensions: {
                code: 'UNAUTHORIZED',
            }
        });
    }
}

export interface AuthPayload {
    userId: string;
    email?: string;
    role: 'ADMIN' | 'MANAGER' | 'USER';
}

export const STAFF_ROLES = ['ADMIN', 'MANAGER'] as const;

export const isStaff = (payload: AuthPayload) => (STAFF_ROLES as readonly string[]).includes(payload.role);

// Members may only reach their own records; staff may reach anyone's
export const requireSelfOrStaff = (token: string | undefined, ownerUserId: string | null | undefined) => {
    const payload = requireAuth(token);
    if (!isStaff(payload) && String(ownerUserId) !== payload.userId) {
        throw new GraphQLError('Forbidden: you can only view your own records', {
            extensions: { code: 'FORBIDDEN' }
        });
    }
    return payload;
}

export const requireRole = (token: string | undefined, roles: readonly string[]) => {
    const payload = requireAuth(token);
    if (!roles.includes(payload.role)) {
        throw new GraphQLError('Forbidden: your role cannot perform this action', {
            extensions: { code: 'FORBIDDEN' }
        });
    }
    return payload;
}