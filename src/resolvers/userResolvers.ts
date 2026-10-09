import { User } from "@/types";
import { requireAuth, requireRole, STAFF_ROLES } from "../utils/auth.js";
import { GraphQLError } from "graphql";
import { ApolloError } from "apollo-server-errors";
import { handleLoginResponse } from "../utils/loginMiddleware.js";

// Bio data only the member may change about themselves (staff may change role/status only)
const PROFILE_FIELDS = ['first_name', 'last_name', 'other_name', 'email', 'contact', 'dob', 'gender', 'avatar'] as const;
const STAFF_EDITABLE_FIELDS = ['role', 'status'];
const AVATAR_PATTERN = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
const MAX_AVATAR_LENGTH = 200 * 1024;

const badInput = (message: string) => new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });

const validateAvatar = (avatar: unknown) => {
    if (avatar === undefined || avatar === null) return;   // null removes the avatar
    if (typeof avatar !== 'string' || !AVATAR_PATTERN.test(avatar)) throw badInput('Avatar must be a JPEG image');
    if (avatar.length > MAX_AVATAR_LENGTH) throw badInput('Avatar image is too large (max 200 KB)');
};

const definedOnly = (values: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));

export default {
    
    User: {
        account: async(user: any, _: any, context: any) => {
            if (!user.hasAccount) return null;
            // Fetch the account associated with the user
            const response = await context.loaders.userAccountLoader.load(user.id);
            return response
        },
        fullName: (user: User) => {
            // Combine first_name, last_name, and other_name to create full name
            return [user.first_name, user.last_name, user.other_name].filter(Boolean).join(' ');
        }
    },
    Query: {
        // TODO: Implement dataloaders for each accountfetch and pagination
        getUsers: async (_: any, __: any, context: any) => {
            // Check if the user is authenticated
            await requireAuth(context.token);
            const response = await context.restAPI.getAllUsers();
            return response
        },
        getUserById: async (_: any, { id }: { id: string }, context: any) => {
            await requireAuth(context.token);
            const response = await context.restAPI.getUserById(id);
            // if(!response) return null
            return response;
        },
        me: async (_: any, __: any, context: any) => {
            const { userId } = requireAuth(context.token);
            return context.restAPI.getUserById(userId);
        },
        getHealthCheck: async (_: any, __: any, context: any) => {
            const response = await context.restAPI.getHealthCheck();
            return response.status;
        },

    },
    Mutation: {
        createUser: async (_: any, { user }: { user: any }, context: any) => {
            await requireAuth(context.token);
            // Forward user creation to REST API (REST API handles hashing)
            const response = await context.restAPI.createUser(user);
            // Remove password from response if present
            if (response && response.password) {
                delete response.password;
            }
            return response;
        },
        // Staff edits: on other members only role and status may change; bio data is the member's own
        updateUser: async (_: any, { id, updateData }:  {id: string, updateData: Partial<User>}, context: any) => {
            const caller = requireRole(context.token, STAFF_ROLES);
            const changes = definedOnly(updateData || {});
            if (String(id) !== caller.userId) {
                const blocked = Object.keys(changes).filter(field => !STAFF_EDITABLE_FIELDS.includes(field));
                if (blocked.length) {
                    throw new GraphQLError(`Only the member can change their own details (${blocked.join(', ')})`, {
                        extensions: { code: 'FORBIDDEN' }
                    });
                }
            }
            return context.restAPI.updateUser(id, changes);
        },
        // The signed-in user's own profile; the id always comes from the session
        updateMyProfile: async (_: any, { input }: { input: Record<string, unknown> }, context: any) => {
            const { userId } = requireAuth(context.token);
            validateAvatar(input.avatar);
            const changes = definedOnly(Object.fromEntries(PROFILE_FIELDS.map(field => [field, input[field]])));
            return context.restAPI.updateUser(userId, changes);
        },
        deleteUser: async (_: any, { id }: { id: string }, context: any) => {
            await requireAuth(context.token);
            const response = await context.restAPI.deleteUser(id);
            return response.message;
        },
        login: async (_: any, { email, password }: { email: string, password: string }, context: any) => {
            // console.log('Login mutation called with:', { email });
            try {
                const result = await context.restAPI.login({ email, password });
                // console.log('Login resolver received from REST API:', result);
                return handleLoginResponse(result, context);
            } catch (error: any) {
                // RESTDataSource throws on non-2xx replies with the HTTP status in extensions.response
                const status = error?.extensions?.response?.status;
                if (status === 400 || status === 401) {
                    return handleLoginResponse({ error: { code: 'INVALID_CREDENTIALS' } }, context);
                }
                if (status) {
                    return handleLoginResponse({ error: { code: 'SERVER_ERROR' } }, context);
                }
                // No HTTP response at all: network issues, REST API down, etc.
                return handleLoginResponse({
                    error: {
                        isFetchError: true,
                        message: error instanceof Error ? error.message : 'Failed to connect to authentication service'
                    }
                }, context);
            }
        },
        logout: (_: any, __: any, context: any) => {
            // Clear Cookie
            context.res.clearCookie('token', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production', // Set to true in production
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Prevent CSRF attacks
            });
            return true; // Indicate successful logout
        }
    }
}