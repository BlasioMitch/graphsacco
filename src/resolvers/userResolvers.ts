import { User } from "@/types";

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
            const response = await context.restAPI.getAllUsers();
            return response
        },
        getUserById: async (_: any, { id }: { id: string }, context: any) => {
            const response = await context.restAPI.getUserById(id);
            // if(!response) return null
            return response;
        },

    },
    Mutation: {
        createUser: async (_: any, { user }: { user: any }, context: any) => {
            console.log('Creating user:', user);
            const response = await context.restAPI.createUser(user);
            return response;
        },
        updateUser: async (_: any, { id, updateData }:  {id: String, updateData:Partial<User>}, context: any) => {
            const response = await context.restAPI.updateUser(id, updateData);
            console.log('Updated user:', response);
            return response;
        },
        deleteUser: async (_: any, { id }: { id: string }, context: any) => {
            const response = await context.restAPI.deleteUser(id);
            return response.message;
        }
    }
}