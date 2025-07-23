import { ApolloServerPlugin } from '@apollo/server';

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
