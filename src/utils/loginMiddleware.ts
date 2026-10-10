import { GraphQLError } from 'graphql';

// What the REST API answers to a sign-in step: a session ({ token, user }) or, with 2-step verification
// on, a challenge ({ twoFactorRequired, challengeToken }) that must be exchanged for a session with the code
interface SignInResult {
    token?: string;
    user?: any;
    mustChangePassword?: boolean;
    twoFactorRequired?: boolean;
    challengeToken?: string;
}

const COOKIE_OPTIONS = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
});

export const setSessionCookie = (context: any, token: string) =>
    context.res.cookie('token', token, { ...COOKIE_OPTIONS(), maxAge: 24 * 60 * 60 * 1000 });

export const clearSessionCookie = (context: any) => context.res.clearCookie('token', COOKIE_OPTIONS());

// The web app keeps the session in the httpOnly cookie; the phone app keeps the returned token
export const toAuthPayload = (result: SignInResult, context: any) => {
    if (result?.twoFactorRequired && result.challengeToken) {
        // No session yet: make sure an older cookie does not linger either
        clearSessionCookie(context);
        return {
            success: true,
            message: 'Enter your 2-step verification code',
            token: null,
            user: result.user ?? null,
            twoFactorRequired: true,
            challengeToken: result.challengeToken,
            mustChangePassword: false,
        };
    }
    if (!result?.token) {
        throw new GraphQLError('Login failed', { extensions: { code: 'INVALID_RESPONSE' } });
    }
    setSessionCookie(context, result.token);
    return {
        success: true,
        message: result.mustChangePassword ? 'Choose a new password to continue' : 'Login successful',
        token: result.token,
        user: result.user,
        twoFactorRequired: false,
        challengeToken: null,
        mustChangePassword: Boolean(result.mustChangePassword),
    };
};

// Turns a failed sign-in call into the error codes the apps branch on
export const signInError = (error: any, fallbackCode = 'INVALID_CREDENTIALS') => {
    const response = error?.extensions?.response;
    const status = response?.status;
    const body = response?.body ?? {};
    if (body.code === 'TEMP_PASSWORD_EXPIRED' || body.code === 'DEVICE_REVOKED') {
        return new GraphQLError(body.error, { extensions: { code: body.code } });
    }
    if (status === 400 || status === 401) {
        const message = fallbackCode === 'INVALID_CREDENTIALS' ? 'Invalid email or password' : (body.error || 'Sign-in failed');
        return new GraphQLError(message, { extensions: { code: fallbackCode } });
    }
    if (status) {
        return new GraphQLError('Internal server error', { extensions: { code: 'SERVER_ERROR' } });
    }
    // No HTTP response at all: network issues, REST API down, etc.
    return new GraphQLError('Service temporarily unavailable', {
        extensions: {
            code: 'REST_API_UNREACHABLE',
            details: error instanceof Error ? error.message : 'Failed to connect to authentication service',
        },
    });
};
