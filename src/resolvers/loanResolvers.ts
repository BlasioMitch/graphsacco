import { requireAuth } from '../utils/auth.js';
import { Loan } from '@/types';

export default {
    Loan:{
        summary: async (loan: any, _: any, context: any) => {
            if (!loan.id) return null;
            const response = await context.loaders.loanSummaryLoader.load(loan.id);
            // const response = await context.restAPI.getLoanSummaryByLoanId(loan.id);
            return response;
        },
        account: async (loan: any, _: any, context: any) => {
            if (!loan.accountId) return null;
            const response = await context.loaders.loanAccountLoader.load(loan.accountId);
            // const response = await context.restAPI.getAccountById(loan.accountId);
            return response;
        }
    },
    Query: {
        getLoans: async (_: any, {accountId}: {accountId: string}, context: any) => {
            await requireAuth(context.token);

            if (accountId) {
                const response = await context.restAPI.getLoansByAccountId(accountId);
                // console.log('Response from getLoanByAccountId:', response);
                return response;
            }
            const response = await context.restAPI.getAllLoans();
            // console.log('Response from getAllLoans:', response);
            return response;
        },
    },
    // TODO: Add mutations for creating, updating, and deleting loans
    Mutation: {
        createLoan: async (_: any, { loan }: { loan: any }, context: any) => {
            await requireAuth(context.token);
            const response = await context.restAPI.createLoan(loan);
            return response;
        },
        updateLoan: async (_: any, { id, updateData }: { id: string, updateData: Partial<Loan> }, context: any) => {
            await requireAuth(context.token);
            const response = await context.restAPI.updateLoan(id, updateData);
            return response;
        },
        deleteLoan: async (_: any, { id }: { id: string }, context: any) => {
            await requireAuth(context.token);
            const response = await context.restAPI.deleteLoan(id);
            return response.message;   
        }
    }
}