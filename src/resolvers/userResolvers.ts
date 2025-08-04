import { User } from "@/types";
import { requireAuth } from "../utils/auth.js";
import { ApolloError } from "apollo-server-errors"

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
        updateUser: async (_: any, { id, updateData }:  {id: String, updateData:Partial<User>}, context: any) => {
            await requireAuth(context.token);
            const response = await context.restAPI.updateUser(id, updateData);
            console.log('Updated user:', response);
            return response;
        },
        deleteUser: async (_: any, { id }: { id: string }, context: any) => {
            await requireAuth(context.token);
            const response = await context.restAPI.deleteUser(id);
            return response.message;
        },
        login: async (_: any, { email, password }: { email: string, password: string }, context: any) => {
            
            console.log('Login mutation called with:', { email });
            try {
                const result = await context.restAPI.login({ email, password });
                console.log('Login resolver received from REST API:', result);
                if(!result || !result.token) {
                    throw new ApolloError('Invalid login response from REST service', 'INVALID_REST_RESPONSE', {result})
                }
                await context.res.cookie('token', result.token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
                    maxAge: 24 * 60 * 60 * 1000,
                });
                return result;
            } catch (error) {
                console.error('Login resolver error:', error);
                throw new ApolloError('Login failed', 'LOGIN_ERROR',{
                    original: error instanceof Error ? error.message: error
                });
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