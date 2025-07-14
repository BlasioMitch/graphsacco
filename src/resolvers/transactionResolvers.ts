export default {
    Query: {
        getTransactions: async (_: any, {accountId}:{accountId: string}, context: any) => {
            if (accountId) {
                const response = await context.restAPI.getTransactionByAccountId(accountId);
                return response;
            }
            const response = await context.restAPI.getAllTransactions();
            return response;
        }
    }
}