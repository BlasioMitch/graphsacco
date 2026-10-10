import { requireRole, STAFF_ROLES } from "../utils/auth.js";

// Bookkeeping reports for ADMIN and MANAGER users; the REST API builds them from the ledger
const report = (type: string) => async (_: any, args: Record<string, unknown>, context: any) => {
    requireRole(context.token, STAFF_ROLES);
    return context.restAPI.getReport(type, args);
};

export default {
    Query: {
        cashBook: report('cash-book'),
        incomeStatement: report('income-statement'),
        trialBalance: report('trial-balance'),
        balanceSheet: report('balance-sheet'),
        loanPortfolio: report('loan-portfolio'),
    },
};
