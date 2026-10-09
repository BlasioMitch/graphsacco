import { requireAuth, requireRole, STAFF_ROLES } from '../utils/auth.js';
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
            requireRole(context.token, STAFF_ROLES);

            if (accountId) {
                const response = await context.restAPI.getLoansByAccountId(accountId);
                // console.log('Response from getLoanByAccountId:', response);
                return response;
            }
            const response = await context.restAPI.getAllLoans();
            // console.log('Response from getAllLoans:', response);
            return response;
        },
        getLoanApplications: async (_: any, { status }: { status?: string }, context: any) => {
            requireRole(context.token, STAFF_ROLES);
            return context.restAPI.getLoansByStatus(status || 'PENDING');
        },
        loanSettings: async (_: any, __: any, context: any) => {
            requireAuth(context.token);
            return context.restAPI.getLoanSettings();
        },
    },
    // TODO: Add mutations for creating, updating, and deleting loans
    Mutation: {
        // The applicant is always the signed-in user (never an id sent by the app)
        applyForLoan: async (_: any, { input }: { input: { amount: number, term: number, purpose?: string } }, context: any) => {
            const { userId } = requireAuth(context.token);
            return context.restAPI.applyForLoan({ userId, amount: input.amount, term: input.term, purpose: input.purpose });
        },
        approveLoan: async (_: any, { id, ...decision }: { id: string, interestRate?: number, startDate?: string, note?: string }, context: any) => {
            requireRole(context.token, STAFF_ROLES);
            return context.restAPI.approveLoan(id, decision);
        },
        rejectLoan: async (_: any, { id, reason }: { id: string, reason: string }, context: any) => {
            requireRole(context.token, STAFF_ROLES);
            return context.restAPI.rejectLoan(id, reason);
        },
        payLoanFromSavings: async (_: any, { id, amount }: { id: string, amount: number }, context: any) => {
            requireRole(context.token, STAFF_ROLES);
            return context.restAPI.payLoanFromSavings(id, amount);
        },
        createLoan: async (_: any, { loan }: { loan: any }, context: any) => {
            requireRole(context.token, STAFF_ROLES);
            const response = await context.restAPI.createLoan(loan);
            return response;
        },
        // The schema passes the fields as flat arguments; forward only the ones that were sent
        updateLoan: async (_: any, { id, ...fields }: { id: string } & Partial<Loan>, context: any) => {
            requireRole(context.token, STAFF_ROLES);
            const updateData = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
            const response = await context.restAPI.updateLoan(id, updateData);
            return response;
        },
        deleteLoan: async (_: any, { id }: { id: string }, context: any) => {
            requireRole(context.token, STAFF_ROLES);
            const response = await context.restAPI.deleteLoan(id);
            return response.message;   
        }
    }
}