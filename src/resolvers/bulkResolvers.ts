import { requireRole, STAFF_ROLES } from '../utils/auth.js';

// Staff only; the REST layer saves each row in its own DB transaction and reports per-row results
export default {
    Mutation: {
        bulkCreateUsers: async (_: any, { users }: { users: any[] }, context: any) => {
            requireRole(context.token, STAFF_ROLES);
            return context.restAPI.bulkCreate('users', users);
        },
        bulkCreateTransactions: async (_: any, { transactions }: { transactions: any[] }, context: any) => {
            requireRole(context.token, STAFF_ROLES);
            return context.restAPI.bulkCreate('transactions', transactions);
        },
        bulkCreateLoans: async (_: any, { loans }: { loans: any[] }, context: any) => {
            requireRole(context.token, STAFF_ROLES);
            return context.restAPI.bulkCreate('loans', loans);
        },
    },
};
