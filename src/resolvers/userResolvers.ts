import { User } from "@/types";
import { requireAuth, requireRole, requireSelfOrStaff, STAFF_ROLES } from "../utils/auth.js";
import { GraphQLError } from "graphql";

// Bio data only the member may change about themselves (staff may change role/status only)
const PROFILE_FIELDS = ['first_name', 'last_name', 'other_name', 'email', 'contact', 'dob', 'gender', 'avatar'] as const;
const STAFF_EDITABLE_FIELDS = ['role', 'status'];
const SETTINGS_FIELDS = ['twoFactorEnabled', 'notifyTransactions', 'notifyUpdates', 'notifyLoanDecisions'] as const;
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
            requireRole(context.token, STAFF_ROLES);
            const response = await context.restAPI.getAllUsers();
            return response
        },
        getUserById: async (_: any, { id }: { id: string }, context: any) => {
            requireSelfOrStaff(context.token, id);
            const response = await context.restAPI.getUserById(id);
            // if(!response) return null
            return response;
        },
        me: async (_: any, __: any, context: any) => {
            const { userId } = requireAuth(context.token, { allowPasswordChange: true });
            return context.restAPI.getUserById(userId);
        },
        myNotifications: async (_: any, { limit, unreadOnly }: { limit?: number, unreadOnly?: boolean }, context: any) => {
            const { userId } = requireAuth(context.token);
            return context.restAPI.getNotifications(userId, limit, Boolean(unreadOnly));
        },
        getHealthCheck: async (_: any, __: any, context: any) => {
            const response = await context.restAPI.getHealthCheck();
            return response.status;
        },

    },
    Mutation: {
        createUser: async (_: any, { user }: { user: any }, context: any) => {
            requireRole(context.token, STAFF_ROLES);
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
        updateMySettings: async (_: any, { input }: { input: Record<string, unknown> }, context: any) => {
            const { userId } = requireAuth(context.token);
            const changes = definedOnly(Object.fromEntries(SETTINGS_FIELDS.map(field => [field, input[field]])));
            return context.restAPI.updateUser(userId, changes);
        },
        changeMyPassword: async (_: any, { currentPassword, newPassword }: { currentPassword: string, newPassword: string }, context: any) => {
            const { userId } = requireAuth(context.token);
            await context.restAPI.changePassword(userId, { currentPassword, newPassword });
            return true;
        },
        changeMyEmail: async (_: any, { email, password }: { email: string, password: string }, context: any) => {
            const { userId } = requireAuth(context.token);
            return context.restAPI.changeEmail(userId, { email, password });
        },
        markNotificationsRead: async (_: any, { ids }: { ids?: string[] | null }, context: any) => {
            const { userId } = requireAuth(context.token);
            const result = await context.restAPI.markNotificationsRead(userId, ids ?? null);
            return result.updated;
        },
        deleteUser: async (_: any, { id }: { id: string }, context: any) => {
            requireRole(context.token, STAFF_ROLES);
            const response = await context.restAPI.deleteUser(id);
            return response.message;
        }

    }
}