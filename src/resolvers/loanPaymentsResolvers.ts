import { requireRole, requireSelfOrStaff, STAFF_ROLES } from '../utils/auth.js';
import { buildLoanPaymentsReport } from '../utils/loanPayments.js';
import { validatePeriod } from '../utils/periods.js';

export default {
    Query: {
        getLoanPaymentsReport: async (_: any, { year, month }: { year: number, month?: number | null }, context: any) => {
            requireRole(context.token, STAFF_ROLES);
            validatePeriod(year, month);

            // Four REST calls in parallel (loans include their summary), joined in memory
            const [transactions, loans, accounts, users] = await Promise.all([
                context.restAPI.getAllTransactions(),
                context.restAPI.getAllLoans(),
                context.restAPI.getAllAccounts(),
                context.restAPI.getAllUsers(),
            ]);

            return buildLoanPaymentsReport(transactions || [], loans || [], accounts || [], users || [], year, month ?? null);
        },
    },
};
