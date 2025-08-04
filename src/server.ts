import 'dotenv/config';
import {ApolloServerPluginDrainHttpServer} from '@apollo/server/plugin/drainHttpServer'
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { expressMiddleware } from '@as-integrations/express4'
import { IncomingMessage, ServerResponse } from 'http';
import { ApolloServer } from '@apollo/server';
import express from 'express';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { loggingPlugin } from './utils/logging.js';
import DataLoader from 'dataloader';
import { typeDefs } from './schemas/index.js';
import { getResolvers } from './resolvers/index.js';
import { RestAPI } from './datasources/RestAPI.js';
import {  extractTokenFromCookie } from './utils/auth.js';
import { userAccountLoader,accountOwnerLoader, accountTransactionsLoader, accountLoansLoader, loanSummaryLoader, loanAccountLoader } from './loaders/index.js';
import { Account, User, Loan, Loansummary, Transaction } from './types/index.js';
import { pingRestService } from './utils/pingRest.js';

// const cookieParser  = require('cookie-parser')

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
    };
    req: IncomingMessage;
    res: ServerResponse;
}

const app = express();
const httpServer = http.createServer(app);

const resolvers = await getResolvers();

const server = new ApolloServer<ContextValue>({
    typeDefs,
    resolvers,
    plugins: [
      loggingPlugin, 
      ApolloServerPluginDrainHttpServer({httpServer})
      , ApolloServerPluginLandingPageLocalDefault()
    ],
});

await server.start();

app.use(cookieParser())

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin: string | undefined, callback: any) => {
    // allow non-browser tools like curl (no origin)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn(`Blocked CORS origin: ${origin}`);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

app.use(
  '/graphql',
  cors<cors.CorsRequest>(corsOptions),
  express.json(),
  expressMiddleware(server, {
        context: async ({ req, res }) => {
        // Authenticate frontend request using Bearer JWT
        let token: string | undefined = undefined;
        try {
          token = extractTokenFromCookie(req);
        } catch  {
          token = undefined
        }
        // Generate internal API key for REST API
        const apiKey = process.env.INTERNAL_API_KEY as string;
        const restAPI = new RestAPI();
        await restAPI.initialize({
            context: {
                token,
                apiKey,
            },
        });
        return {
            token: token || null,
            apiKey,
            restAPI,
            loaders:{
              userAccountLoader: userAccountLoader(restAPI),
              accountOwnerLoader: accountOwnerLoader(restAPI), 
              accountLoansLoader: accountLoansLoader(restAPI),
              accountTransactionsLoader: accountTransactionsLoader(restAPI),
              loanSummaryLoader: loanSummaryLoader(restAPI),
              loanAccountLoader: loanAccountLoader(restAPI),
            },
            req,
            res
        };
    },

  })
)
const PORT = process.env.PORT || 4000;
await new Promise<void>((resolve) => {
  httpServer.listen(PORT, async () => {
    console.log(httpServer.address()) ;
    await pingRestService()
    resolve();
  })
})
console.log(`🚀 Server ready at http://localhost:${PORT}`);
