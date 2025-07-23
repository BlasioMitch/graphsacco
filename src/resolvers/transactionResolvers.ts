import {  Transaction } from "@/types";
import { requireAuth } from "../utils/auth.js";

export default {
    Transaction: {
        account: async (transaction: Transaction, _: any, context: any) => {
            const response = await context.restAPI.getAccountById(transaction.accountId)
            return response
        }
    },
    Query: {
        getTransactions: async (_: any, {accountId}:{accountId: string}, context: any) => {
            await requireAuth(context.token);
            if (accountId) {
                const response = await context.restAPI.getTransactionByAccountId(accountId);
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
        updateTransaction: async (_: any, { id, updateData }: { id: string, updateData: Partial<Transaction> }, context: any) => {
            await requireAuth(context.token);
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