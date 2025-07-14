import 'dotenv/config';
import { ApolloServer } from '@apollo/server';
import { ApolloServerPlugin } from '@apollo/server';
import DataLoader from 'dataloader';
import { startStandaloneServer } from '@apollo/server/standalone';
import { typeDefs } from './schemas/index.js';
import { getResolvers } from './resolvers/index.js';
import { RestAPI } from './datasources/RestAPI.js';
import {  generateApiToken } from './utils/auth.js';
import { userAccountLoader,accountOwnerLoader, accountTransactionsLoader, accountLoansLoader, loanSummaryLoader, loanAccountLoader } from './loaders/index.js';
import { Account, User, Loan, Loansummary, Transaction } from './types/index.js';


export const loggingPlugin: ApolloServerPlugin = {
  async requestDidStart(requestContext) {
    const { request } = requestContext;

    console.log('📥 New GraphQL Request');
    console.log('📝 Operation Name:', request.operationName);
    console.log('⚙️  Operation Type:', request.query?.trim().split(' ')[0]); // usually 'query' or 'mutation'
    console.log('📄 Query:', request.query?.replace(/\s+/g, ' ').trim());
    console.log('📦 Variables:', JSON.stringify(request.variables, null, 2));

    return {
      async willSendResponse(responseContext) {
        console.log('✅ Response sent with status code:', responseContext.response.http?.status ?? 'N/A');
        console.log('===========================');
      },
    };
  },
};

interface ContextValue{
    token: string | null;
    apiKey: string;
    restAPI: RestAPI;
    loaders:{
      userAccountLoader: DataLoader<string, Account | null>;
      accountOwnerLoader: DataLoader<string, User | null>;
      accountLoansLoader: DataLoader<string, Loan[] | null>;
      accountTransactionsLoader: DataLoader<string, Transaction[] | null>;
      loanSummaryLoader: DataLoader<string, Loansummary | null>;
      loanAccountLoader: DataLoader<string, Account | null>;
    }
}

(async () => {
    const resolvers = await getResolvers();
    const server = new ApolloServer<ContextValue>({
        typeDefs,
        resolvers,
        plugins: [loggingPlugin],
    });
    const { url } = await startStandaloneServer(server, {
        context: async ({ req }: { req: import('http').IncomingMessage }) => {
            // Authenticate frontend request using Bearer JWT
            let token: string | null = null;
            // try {
            //     token = authenticateRequest(req);
            // } catch (err) {
            //     throw new Error('Unauthorized: ' + (err as Error).message);
            // }
            // Generate internal API key for REST API
            const apiKey = generateApiToken();
            const restAPI = new RestAPI();
            await restAPI.initialize({
                context: {
                    // token,
                    apiKey,
                },
            });
            return {
                token:null,
                apiKey,
                restAPI,
                loaders:{
                  userAccountLoader: userAccountLoader(restAPI),
                  accountOwnerLoader: accountOwnerLoader(restAPI), 
                  accountLoansLoader: accountLoansLoader(restAPI),
                  accountTransactionsLoader: accountTransactionsLoader(restAPI),
                  loanSummaryLoader: loanSummaryLoader(restAPI),
                  loanAccountLoader: loanAccountLoader(restAPI),
                }
            }
        }
    })
    console.log(`🚀 Server ready at ${url}`);
})();