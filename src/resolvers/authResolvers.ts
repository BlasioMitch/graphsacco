import { GraphQLError } from "graphql";
import { requireAuth, requireRole, STAFF_ROLES } from "../utils/auth.js";
import { clearSessionCookie, signInError, toAuthPayload } from "../utils/loginMiddleware.js";

const badInput = (message: string) => new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });

export default {
    Query: {
        passwordResets: async (_: any, { status }: { status?: string | null }, context: any) => {
            requireRole(context.token, STAFF_ROLES);
            return context.restAPI.getPasswordResets(status);
        },
        passwordReset: async (_: any, { id }: { id: string }, context: any) => {
            requireRole(context.token, STAFF_ROLES);
            return context.restAPI.getPasswordReset(id);
        },
        myTrustedDevices: async (_: any, __: any, context: any) => {
            const { userId } = requireAuth(context.token);
            return context.restAPI.getTrustedDevices(userId);
        },
        myPasskeys: async (_: any, __: any, context: any) => {
            const { userId } = requireAuth(context.token);
            return context.restAPI.getPasskeys(userId);
        },
    },
    Mutation: {
        login: async (_: any, { email, password }: { email: string, password: string }, context: any) => {
            let result;
            try {
                result = await context.restAPI.login({ email, password });
            } catch (error) {
                throw signInError(error);
            }
            return toAuthPayload(result, context);
        },
        verifyTwoFactor: async (_: any, { challengeToken, code }: { challengeToken: string, code: string }, context: any) => {
            let result;
            try {
                result = await context.restAPI.verifyTwoFactor(challengeToken, code);
            } catch (error: any) {
                // 401: the challenge expired (sign in again); 400: wrong code (try again)
                const status = error?.extensions?.response?.status;
                throw signInError(error, status === 401 ? 'CHALLENGE_EXPIRED' : 'INVALID_CODE');
            }
            return toAuthPayload(result, context);
        },
        logout: async (_: any, __: any, context: any) => {
            try {
                requireAuth(context.token, { allowPasswordChange: true });
                await context.restAPI.recordAudit('LOGOUT', 'Signed out');
            } catch {
                // Signing out always succeeds, even with an expired session
            }
            clearSessionCookie(context);
            return true;
        },
        requestPasswordReset: async (_: any, { email }: { email: string }, context: any) => {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim())) throw badInput('Enter a valid email address');
            return context.restAPI.forgotPassword(String(email).trim());
        },
        setNewPassword: async (_: any, { newPassword }: { newPassword: string }, context: any) => {
            const { userId } = requireAuth(context.token, { allowPasswordChange: true });
            const result = await context.restAPI.replaceTemporaryPassword(userId, newPassword);
            return toAuthPayload(result, context);
        },
        completePasswordReset: async (_: any, { id, password }: { id: string, password: string }, context: any) => {
            requireRole(context.token, STAFF_ROLES);
            return context.restAPI.completePasswordReset(id, password);
        },
        dismissPasswordReset: async (_: any, { id, note }: { id: string, note?: string | null }, context: any) => {
            requireRole(context.token, STAFF_ROLES);
            return context.restAPI.dismissPasswordReset(id, note);
        },
        enrollBiometric: async (_: any, { deviceName }: { deviceName?: string | null }, context: any) => {
            const { userId } = requireAuth(context.token);
            return context.restAPI.enrollBiometric(userId, deviceName);
        },
        biometricLogin: async (_: any, { deviceId, secret }: { deviceId: string, secret: string }, context: any) => {
            let result;
            try {
                result = await context.restAPI.biometricLogin(deviceId, secret);
            } catch (error) {
                throw signInError(error, 'DEVICE_REVOKED');
            }
            return toAuthPayload(result, context);
        },
        passkeyRegistrationOptions: async (_: any, __: any, context: any) => {
            const { userId } = requireAuth(context.token);
            return context.restAPI.passkeyRegistrationOptions(userId);
        },
        addPasskey: async (_: any, args: { challengeToken: string, response: unknown, deviceName?: string | null }, context: any) => {
            const { userId } = requireAuth(context.token);
            return context.restAPI.addPasskey(userId, args);
        },
        passkeyLoginOptions: async (_: any, { email }: { email?: string | null }, context: any) =>
            context.restAPI.passkeyLoginOptions(email),
        passkeyLogin: async (_: any, { challengeToken, response }: { challengeToken: string, response: unknown }, context: any) => {
            let result;
            try {
                result = await context.restAPI.passkeyLogin(challengeToken, response);
            } catch (error) {
                throw signInError(error, 'PASSKEY_REJECTED');
            }
            return toAuthPayload(result, context);
        },
        removePasskey: async (_: any, { id }: { id: string }, context: any) => {
            const { userId } = requireAuth(context.token);
            const result = await context.restAPI.removePasskey(userId, id);
            return result.removed;
        },
        reportDeviceEvents: async (_: any, { events }: { events: unknown[] }, context: any) => {
            requireAuth(context.token);
            const result = await context.restAPI.reportDeviceEvents(events);
            return result.recorded;
        },
        revokeBiometric: async (_: any, { deviceId }: { deviceId?: string | null }, context: any) => {
            const { userId } = requireAuth(context.token);
            const result = await context.restAPI.revokeBiometric(userId, deviceId);
            return result.revoked;
        },
    },
};
