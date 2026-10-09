import {  Transaction } from "@/types";
import { requireAuth } from "../utils/auth.js";

export default {
    Transaction: {
        // Batched per request through the account-by-id loader (was one REST call per row)
        account: async (transaction: Transaction, _: any, context: any) => {
            if (!transaction.accountId) return null
            return context.loaders.loanAccountLoader.load(transaction.accountId)
        }
    },
    Query: {
        getTransactions: async (_: any, {accountId}:{accountId: string}, context: any) => {
            await requireAuth(context.token);
            if (accountId) {
                const response = await context.restAPI.getTransactionsByAccountId(accountId);
                return response;
            }
            const response = await context.restAPI.getAllTransactions();
            return response;
        }
    },
    // TODO: Add mutations for creating, updating, and deleting transactions
    Mutation: {
        createTransaction: async (_: any, { transaction }: { transaction: Transaction }, context: any) => {
            await requireAuth(context.token);
            const response = await context.restAPI.createTransaction(transaction);
            return response;
        },
        // The schema passes the fields as flat arguments; forward only the ones that were sent
        updateTransaction: async (_: any, { id, ...fields }: { id: string } & Partial<Transaction>, context: any) => {
            await requireAuth(context.token);
            const updateData = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
            const response = await context.restAPI.updateTransaction(id, updateData);
            return response;
        },
        deleteTransaction: async (_: any, { id }: { id: string }, context: any) => {
            await requireAuth(context.token);
            const response = await context.restAPI.deleteTransaction(id);
            return response.message;
        }
    }
}