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

// The verified caller (if any) and which app sent the request, for the REST API's audit trail.
// Never throws: an invalid token simply means no actor.
export const readRequestOrigin = (req: IncomingMessage, token?: string) => {
    let actor: AuthPayload | null = null;
    if (token) {
        try {
            const payload = verifyToken(token) as AuthPayload & { purpose?: string };
            if (payload?.userId && !payload.purpose) actor = { userId: payload.userId, email: payload.email, role: payload.role };
        } catch {
            actor = null;
        }
    }
    const clientHeader = String(req.headers['x-client'] || '').toLowerCase();
    const client = clientHeader === 'web' || clientHeader === 'mobile' ? clientHeader : null;
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const ip = forwarded || req.socket?.remoteAddress || null;
    const userAgent = req.headers['user-agent'] ? String(req.headers['user-agent']) : null;
    // Passkeys are bound to the web page's origin; offline changes say when they were really made
    const origin = req.headers.origin ? String(req.headers.origin) : null;
    const queuedAt = req.headers['x-queued-at'] ? String(req.headers['x-queued-at']) : null;
    return { actor, client, ip, userAgent, origin, queuedAt } as const;
};

export const extractTokenFromCookie = (req: Request): string | undefined => {
    // console.log(req.cookies,' cookies')
    if( !req.cookies || !req.cookies.token){
        return undefined;
    }
    return req.cookies.token;
}; 

interface RequireAuthOptions {
    // Sessions from a temporary password may only be used to choose a new password (and to sign out)
    allowPasswordChange?: boolean;
}

export const requireAuth = (token: string | undefined, { allowPasswordChange = false }: RequireAuthOptions = {}) => {
    if(!token){
        throw new GraphQLError('Unauthorized: No token provided',{
            extensions: {
                code: 'UNAUTHORIZED',
            }
        });
    }
    let payload: AuthPayload & { purpose?: string };
    try {
        // The signed payload identifies the caller: { userId, email, role }
        payload = verifyToken(token) as AuthPayload & { purpose?: string };
    } catch {
        throw new GraphQLError('Unauthorized: Invalid or expired token',{
            extensions: {
                code: 'UNAUTHORIZED',
            }
        });
    }
    // A 2-step challenge only proves the password; it is never a session
    if (payload.purpose || !payload.userId) {
        throw new GraphQLError('Unauthorized: Invalid or expired token', { extensions: { code: 'UNAUTHORIZED' } });
    }
    if (payload.mustChangePassword && !allowPasswordChange) {
        throw new GraphQLError('Choose a new password to continue', { extensions: { code: 'PASSWORD_CHANGE_REQUIRED' } });
    }
    return payload as AuthPayload;
}

export interface AuthPayload {
    userId: string;
    email?: string;
    role: 'ADMIN' | 'MANAGER' | 'USER';
    mustChangePassword?: boolean;
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