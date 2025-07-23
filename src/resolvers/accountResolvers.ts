import { Account } from "@/types";
// import { requireAuth } from "@/utils/auth";
import { requireAuth } from "../utils/auth.js";
import { GraphQLError } from "graphql";

export default {
    Account: {
        owner: async (account: any, _: any, context: any) => {
            const response = await context.loaders.accountOwnerLoader.load(account.userId);
            return response;
        },
        loans: async (account: any, _: any, context: any) => {
            const response = await context.loaders.accountLoansLoader.load(account.id);
            return response;
        },
        transactions: async (account: any, _: any, context: any) => {
            const response = await context.loaders.accountTransactionsLoader.load(account.id);
            return response;
        }
    },
    Query: {
        getAccounts: async (_: any, __: any, context: any) => {
        //  Check if the user is authenticated
            await requireAuth(context.token);

            const response = await context.restAPI.getAllAccounts();
            return response;
        },
        getAccountById: async (_: any, { id }: { id: string }, context: any) => {
            await requireAuth(context.token);
            const response = await context.restAPI.getAccountById(id);
            return response;
        }
    },
    Mutation: {
        createAccount: async (_: any, { account }: { account: any }, context: any) => {
            await requireAuth(context.token);
            console.log('Creating account:', account);
            const response = await context.restAPI.createAccount(account);
            return response;
        },
        updateAccount: async (_: any, { id, balance, paidMembership, status }: Partial<Account>, context: any) => {
            await requireAuth(context.token);
            const updateData = {
                ...(balance !== undefined && { balance }),
                ...(paidMembership !== undefined && { paidMembership }),
                ...(status !== undefined && { status })
            }
            const response = await context.restAPI.updateAccount(id, updateData);
            return response;
        },
        deleteAccount: async (_: any, { id }: { id: string }, context: any) => {
            await requireAuth(context.token);
            const response = await context.restAPI.deleteAccount(id);
            return response.message || 'Account deleted successfully';
        }
    }
}