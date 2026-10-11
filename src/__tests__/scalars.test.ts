// Money is whole Uganda shillings, exact up to JavaScript's safe integer limit
import { fakeRest, run, tokenFor } from './support/harness.js';

const admin = tokenFor({ userId: 'admin-1', role: 'ADMIN' });
const APPLY = 'mutation($amount: Money!) { applyForLoan(input: { amount: $amount, term: 6 }) { id } }';

describe('Money scalar', () => {
  it('accepts whole shillings, including beyond 32-bit and as integer strings', async () => {
    const rest = fakeRest({ applyForLoan: { id: 'loan-1' } });
    for (const amount of [500000, 5_000_000_000, '7000000']) {
      const res = await run(APPLY, { token: tokenFor({ userId: 'm' }), rest, variables: { amount } });
      expect(res.errors).toBeUndefined();
    }
    expect(rest.applyForLoan).toHaveBeenLastCalledWith(expect.objectContaining({ amount: 7_000_000 }));
  });

  it('rejects fractions and unsafe integers before reaching the REST API', async () => {
    const rest = fakeRest({ applyForLoan: { id: 'loan-1' } });
    for (const amount of [10.5, Number.MAX_SAFE_INTEGER + 2, 'ten']) {
      const res = await run(APPLY, { token: tokenFor({ userId: 'm' }), rest, variables: { amount } });
      expect(res.errors?.[0].message).toMatch(/Money must be a whole number/);
    }
    expect(rest.applyForLoan).not.toHaveBeenCalled();
  });

  it('rejects a decimal literal in the query itself', async () => {
    const res = await run('mutation { applyForLoan(input: { amount: 10.5, term: 6 }) { id } }', { token: admin });
    expect(res.errors?.[0].message).toMatch(/whole numbers/);
  });
});
