import DataLoader from "dataloader";
import { Account, User, Transaction, Loan, Loansummary } from "../types/index.js";
import { RestAPI } from "@/datasources/RestAPI.js";

export const userAccountLoader = (restAPI: RestAPI) => {
    return new DataLoader<string, Account | null>(async (userIds: readonly string[]) => {
        // console.log('Loading accounts for user IDs:', userIds);
        const responses = await Promise.all(userIds.map((id: string) => restAPI.getAccountByUserId(id)));
    
        return responses
    })
}

// Create accountOwnerLoader
export const accountOwnerLoader = (restAPI: RestAPI) => {
  return new DataLoader<string, User | null>(async (accountIds: readonly string[]) => {
    // console.log('Loading owners for account IDs:', accountIds);

    const responses = await Promise.all(
      accountIds.map(async (id: string) => {
        try {
          return await restAPI.getUserById(id);
        } catch (error) {
        //   // You can optionally log the error or ID here if you want
        //   console.warn(`User not found for ID: ${id}`);
          return null;
        }
      })
    );

    return responses;
  });
};

// Create accountLoansLoader
export const accountLoansLoader = (restAPI: RestAPI) => {
    return new DataLoader<string, Loan[] | null>(async (accountIds: readonly string[]) => {
        // console.log('Loading loans for account IDs:', accountIds);
        const responses = await Promise.all(accountIds.map((id: string) => restAPI.getLoansByAccountId(id)));
    
        return responses;
    });
};

// Create accountTransactionsLoader
export const accountTransactionsLoader = (restAPI: RestAPI) => {
    return new DataLoader<string, Transaction[] | null>(async (accountIds: readonly string[]) => {
        // console.log('Loading transactions for account IDs:', accountIds);
        const responses = await Promise.all(accountIds.map((id: string) => restAPI.getTransactionsByAccountId(id)));
    
        return responses;
    });
};

// Create LoanSummaryLoader
export const loanSummaryLoader = (restAPI: RestAPI) => {
    return new DataLoader<string, Loansummary | null>(async (loanIds: readonly string[]) => {
        // console.log('Loading loan summaries for loan IDs:', loanIds);
        const responses = await Promise.all(loanIds.map((id: string) => restAPI.getLoanSummaryByLoanId(id)));
    
        return responses;
    });
};

// Create LoanAccountLoader
export const loanAccountLoader = (restAPI: RestAPI) => {
    return new DataLoader<string, Account | null>(async (loanIds: readonly string[]) => {
        // console.log('Loading accounts for loan IDs:', loanIds);
        const responses = await Promise.all(loanIds.map((id: string) => restAPI.getAccountById(id)));
    
        return responses;
    });
}