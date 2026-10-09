import { requireAuth } from '../utils/auth.js';
import { buildSavingsReport } from '../utils/savings.js';
import { validatePeriod } from '../utils/periods.js';

export default {
    Query: {
        getSavingsReport: async (_: any, { year, month }: { year: number, month?: number | null }, context: any) => {
            await requireAuth(context.token);
            validatePeriod(year, month);

            // Three REST calls in parallel, joined in memory (no per-row requests)
            const [transactions, accounts, users] = await Promise.all([
                context.restAPI.getAllTransactions(),
                context.restAPI.getAllAccounts(),
                context.restAPI.getAllUsers(),
            ]);

            return buildSavingsReport(transactions || [], accounts || [], users || [], year, month ?? null);
        },
    },
};
