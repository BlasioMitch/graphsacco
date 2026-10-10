import { requireRole, STAFF_ROLES } from "../utils/auth.js";

export default {
    // The REST API names the ranges 3M, 6M, 1Y and ALL
    STATSRANGE: {
        THREE_MONTHS: '3M',
        SIX_MONTHS: '6M',
        ONE_YEAR: '1Y',
        ALL: 'ALL',
    },
    Query: {
        dashboardStats: async (_: any, { range }: { range: string }, context: any) => {
            requireRole(context.token, STAFF_ROLES);
            return context.restAPI.getDashboardStats(range);
        },
    },
};
