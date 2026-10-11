// A change made offline can arrive twice; the plugin makes sure it is applied once
import { jest } from '@jest/globals';
import { ApolloServer, HeaderMap } from '@apollo/server';
import { idempotencyPlugin } from '../utils/idempotencyPlugin.js';
import { fakeRest, resolvers, tokenFor, typeDefs } from './support/harness.js';

const server = new ApolloServer({ typeDefs, resolvers, plugins: [idempotencyPlugin] });
beforeAll(() => server.start());
afterAll(() => server.stop());

const KEY = 'cccccccc-3333-4333-8333-000000000001';
const MUTATION = 'mutation MarkRead { markNotificationsRead }';

async function send(query: string, rest: ReturnType<typeof fakeRest>, key: string | null = KEY) {
  const headers = new HeaderMap();
  if (key) headers.set('x-idempotency-key', key);
  const response = await server.executeOperation(
    { query, operationName: query.match(/mutation (\w+)/)?.[1], http: { method: 'POST', headers, search: '', body: {} } },
    { contextValue: { token: tokenFor({ userId: 'member-1' }), restAPI: rest, loaders: {}, req: { headers: {} }, res: {} } as any },
  );
  if (response.body.kind !== 'single') throw new Error('single result expected');
  return response.body.singleResult;
}

describe('idempotency plugin', () => {
  it('claims a new key, runs the change once, and stores its answer', async () => {
    const rest = fakeRest({ claimIdempotency: { status: 'new' }, markNotificationsRead: { updated: 3 } });
    const result = await send(MUTATION, rest);
    expect(result.data).toEqual({ markNotificationsRead: 3 });
    expect(rest.claimIdempotency).toHaveBeenCalledWith(KEY, 'MarkRead');
    expect(rest.markNotificationsRead).toHaveBeenCalledTimes(1);
    expect(rest.completeIdempotency).toHaveBeenCalledWith(KEY, { data: { markNotificationsRead: 3 } });
    expect(rest.releaseIdempotency).not.toHaveBeenCalled();
  });

  it('answers a key that already ran with the stored result, without running it again', async () => {
    const rest = fakeRest({ claimIdempotency: { status: 'done', response: { data: { markNotificationsRead: 3 } } } });
    const result = await send(MUTATION, rest);
    expect(result.data).toEqual({ markNotificationsRead: 3 });
    expect(rest.markNotificationsRead).not.toHaveBeenCalled();
    expect(rest.completeIdempotency).not.toHaveBeenCalled();
  });

  it('says IN_PROGRESS while another copy is running', async () => {
    const rest = fakeRest({ claimIdempotency: { status: 'in_progress' } });
    const result = await send(MUTATION, rest);
    expect(result.errors?.[0].extensions?.code).toBe('IN_PROGRESS');
    expect(rest.markNotificationsRead).not.toHaveBeenCalled();
  });

  it('releases the key when the change fails, so a corrected retry can run', async () => {
    const rest = fakeRest({
      claimIdempotency: { status: 'new' },
      markNotificationsRead: () => { throw new Error('refused'); },
    });
    const result = await send(MUTATION, rest);
    expect(result.errors).toBeDefined();
    expect(rest.releaseIdempotency).toHaveBeenCalledWith(KEY);
    expect(rest.completeIdempotency).not.toHaveBeenCalled();
  });

  it('leaves queries and requests without a key alone', async () => {
    const rest = fakeRest({ markNotificationsRead: { updated: 1 }, getNotifications: { items: [], unreadCount: 0 } });
    await send('{ myNotifications { unreadCount } }', rest);
    await send(MUTATION, rest, null);
    expect(rest.claimIdempotency).not.toHaveBeenCalled();
    expect(rest.markNotificationsRead).toHaveBeenCalledTimes(1);
  });
});

// Keep jest import used in this ESM file (mock helpers come from the harness)
void jest;
