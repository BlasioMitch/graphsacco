import { ApolloError } from 'apollo-server-errors';

interface LoginResponse {
    success: boolean;
    message: string;
    token: string | null;
    user: any | null;
}

interface ErrorResponse {
    error: {
        code?: string;
        message?: string;
        isFetchError?: boolean;
    } | string;
    token?: string;
    user?: any;
}

export const handleLoginResponse = async (result: ErrorResponse, context: any): Promise<LoginResponse> => {
    // Handle unauthorized
    if (
        (typeof result.error === 'string' && result.error === 'UNAUTHENTICATED') ||
        (result.error && (result.error as any).code === 'UNAUTHENTICATED')
    ) {
        console.log('Authentication failed:', result.error);
        throw new ApolloError('Invalid email or password', 'UNAUTHENTICATED', {
            message: 'Invalid credentials provided'
        });
    }

    // Handle invalid credentials
    if (result.error && typeof result.error === 'object' && result.error.code === 'INVALID_CREDENTIALS') {
        console.log('Invalid credentials:', result.error);
        throw new ApolloError('Invalid email or password', 'INVALID_CREDENTIALS', {
            message: 'The provided credentials are incorrect'
        });
    }

    // Handle user not found
    if (result.error && typeof result.error === 'object' && result.error.code === 'USER_NOT_FOUND') {
        console.log('User not found:', result.error);
        throw new ApolloError('User not found', 'USER_NOT_FOUND', {
            message: 'No user exists with the provided email'
        });
    }

    // Handle server errors
    if (result.error && typeof result.error === 'object' && result.error.code === 'SERVER_ERROR') {
        console.log('Server error:', result.error);
        throw new ApolloError('Internal server error', 'SERVER_ERROR', {
            message: 'An unexpected error occurred. Please try again later.'
        });
    }

    // Handle REST API connectivity issues
    if (result.error && typeof result.error === 'object' && result.error.isFetchError) {
        console.error('REST API Connection Error:', result.error);
        throw new ApolloError(
            'Service temporarily unavailable',
            'REST_API_UNREACHABLE',
            {
                message: 'Unable to connect to authentication service. Please try again later.',
                details: result.error.message || 'Connection failed'
            }
        );
    }

    // Handle missing result or token
    if (!result || !result.token) {
        console.log('Invalid response structure:', result);
        throw new ApolloError('Login failed', 'INVALID_RESPONSE', {
            message: 'Invalid response received from authentication service'
        });
    }

    // Successful login
    await context.res.cookie('token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000,
    });

    const response = {
        success: true,
        message: 'Login successful',
        token: result.token,
        user: result.user
    };
    console.log('Sending success response to frontend:', response);
    return response;
};
