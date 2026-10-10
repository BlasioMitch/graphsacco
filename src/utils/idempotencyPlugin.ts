import { ApolloServerPlugin } from '@apollo/server';
import { GraphQLError } from 'graphql';

// Offline changes (web and phone) are sent with an x-idempotency-key and may arrive more than once.
// Before running such a mutation the gateway claims the key with the REST API; a key that already ran
// answers with the stored result instead of applying the change twice.
// A change that fails (e.g. not enough balance) releases its key, so a corrected retry can run.

const header = (headers: { get(name: string): string | undefined } | undefined, name: string) => headers?.get(name) || undefined;

export const idempotencyPlugin: ApolloServerPlugin<any> = {
  async requestDidStart({ request }) {
    const key = header(request.http?.headers, 'x-idempotency-key');
    if (!key) return;
    let claimed = false;

    return {
      async responseForOperation({ operation, contextValue }) {
        if (operation?.operation !== 'mutation') return null;
        const claim = await contextValue.restAPI.claimIdempotency(key, request.operationName ?? null);
        if (claim.status === 'done' && claim.response) {
          return { http: { status: 200, headers: new Map() as any }, body: { kind: 'single', singleResult: claim.response } } as any;
        }
        if (claim.status === 'in_progress') {
          throw new GraphQLError('This change is already being sent. Try again in a moment.', { extensions: { code: 'IN_PROGRESS' } });
        }
        claimed = true;
        return null;
      },
      async willSendResponse({ response, contextValue }) {
        if (!claimed) return;
        const result = response.body.kind === 'single' ? response.body.singleResult : null;
        try {
          if (!result || result.errors?.length) await contextValue.restAPI.releaseIdempotency(key);
          else await contextValue.restAPI.completeIdempotency(key, { data: result.data });
        } catch (error) {
          console.error('Idempotency bookkeeping failed:', error);
        }
      },
    };
  },
};
