import { jest } from '@jest/globals';
import { ApolloServer } from '@apollo/server';
import jwt from 'jsonwebtoken';
import { mergeResolvers } from '@graphql-tools/merge';
import fg from 'fast-glob';
import path from 'path';
import { pathToFileURL } from 'url';
import { typeDefs } from '../../schemas/index.js';

// The real schema and resolvers, run in-process. The REST API is a fake whose methods are jest mocks, so a
// test says what REST answers and checks what the gateway sent it (or that it was never called).
// Same files resolvers/index.ts loads, imported one at a time (Jest's ESM loader trips over parallel imports).
const resolverFiles = fg.sync(path.join(process.cwd(), 'src/resolvers/*.ts'), { ignore: ['**/index.ts'] }).sort();
const modules: any[] = [];
for (const file of resolverFiles) modules.push((await import(pathToFileURL(file).href)).default);
export const resolvers = mergeResolvers(modules);
export { typeDefs };
export const server = new ApolloServer({ typeDefs, resolvers });
await server.start();

type Fn = jest.Mock<(...args: any[]) => Promise<any>>;
export type FakeRest = Record<string, Fn>;

// Any method can be called; unset ones answer null
export function fakeRest(answers: Record<string, any> = {}): FakeRest {
  const methods: FakeRest = {};
  for (const [name, value] of Object.entries(answers)) {
    methods[name] = jest.fn(async (..._args: any[]) => (typeof value === 'function' ? value(..._args) : value)) as Fn;
  }
  return new Proxy(methods, {
    get: (target, name: string) => (target[name] ??= jest.fn(async () => null) as Fn),
  });
}

export interface TokenClaims {
  userId?: string;
  role?: 'ADMIN' | 'MANAGER' | 'USER';
  email?: string;
  mustChangePassword?: boolean;
  purpose?: string;
}

export const tokenFor = ({ userId = 'user-1', role = 'USER', email = `${userId}@test.sacco`, ...rest }: TokenClaims = {}) =>
  jwt.sign({ userId, role, email, ...rest }, process.env.JWT_SECRET as string, { expiresIn: '1h' });

export const challengeToken = (userId = 'user-1') => jwt.sign({ userId, purpose: '2fa' }, process.env.JWT_SECRET as string, { expiresIn: '5m' });

export interface Run {
  token?: string | null;
  rest?: FakeRest;
  variables?: Record<string, unknown>;
  headers?: Record<string, string>;
}

// Runs one operation like the HTTP layer would, returning the result plus what happened to the cookie
export async function run(query: string, { token = null, rest = fakeRest(), variables, headers = {} }: Run = {}) {
  const cookies: { set: Array<[string, string]>; cleared: string[] } = { set: [], cleared: [] };
  const res = {
    cookie: (name: string, value: string) => cookies.set.push([name, value]),
    clearCookie: (name: string) => cookies.cleared.push(name),
  };
  const response = await server.executeOperation(
    { query, variables },
    { contextValue: { token, apiKey: 'test-internal-key', restAPI: rest, loaders: {}, req: { headers }, res } as any },
  );
  if (response.body.kind !== 'single') throw new Error('Expected a single result');
  const { data, errors } = response.body.singleResult;
  return { data: data as any, errors, codes: (errors ?? []).map(error => error.extensions?.code), rest, cookies };
}
