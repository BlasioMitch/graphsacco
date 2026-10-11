// Monthly timelines (Savings page): Kampala months, brought-forward balances, pending deposits apart
import { buildSavingsReport } from '../utils/savings.js';
import { localYearMonth, median, validatePeriod } from '../utils/periods.js';

describe('periods', () => {
  it('buckets by Kampala month (UTC+3)', () => {
    // 22:30 UTC on 31 January is already 1 February in Kampala
    expect(localYearMonth('2026-01-31T22:30:00Z')).toEqual({ year: 2026, month: 2 });
    expect(localYearMonth('2026-01-31T20:59:00Z')).toEqual({ year: 2026, month: 1 });
  });

  it('median of odd and even lists', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBe(0);
  });

  it('rejects periods outside a sensible range', () => {
    expect(() => validatePeriod(1999)).toThrow(/year/);
    expect(() => validatePeriod(2026, 13)).toThrow(/month/);
    expect(() => validatePeriod(2026, 5)).not.toThrow();
  });
});

describe('savings timeline', () => {
  const accounts = [{ id: 'a1', userId: 'u1', accountNumber: 'JS-1' }, { id: 'a2', userId: 'u2', accountNumber: 'AB-2' }] as any[];
  const users = [{ id: 'u1', first_name: 'Jane', last_name: 'Smith' }, { id: 'u2', first_name: 'Abel', last_name: 'Bwire' }] as any[];
  const deposit = (accountId: string, amount: number, createdAt: string, status = 'COMPLETED') =>
    ({ id: `${accountId}-${createdAt}`, accountId, amount, createdAt, status, type: 'SAVINGS_DEPOSIT' });

  const transactions = [
    deposit('a1', 100_000, '2025-12-15T09:00:00Z'),
    deposit('a1', 50_000, '2026-03-10T09:00:00Z'),
    deposit('a1', 30_000, '2026-03-20T09:00:00Z', 'PENDING'),
    deposit('a2', 20_000, '2026-03-05T09:00:00Z'),
    { ...deposit('a2', 999_999, '2026-03-06T09:00:00Z'), type: 'ACCOUNT_WITHDRAW' },
    deposit('deleted-account', 5_000, '2026-03-07T09:00:00Z'),
  ] as any[];

  it('totals the period, carries earlier years forward, and keeps pending deposits apart', () => {
    const report = buildSavingsReport(transactions, accounts, users, 2026, 3);
    expect(report.stats).toMatchObject({ totalSavings: 70_000, transactionCount: 2, pendingSavings: 30_000, pendingCount: 1, highestTotalSaved: 50_000, meanAmount: 35_000 });
    const jane = report.members.find(member => member.accountId === 'a1')!;
    expect(jane.broughtForward).toBe(100_000);
    expect(jane.months[2]).toBe(50_000);
    expect(jane.total).toBe(150_000);
    expect(report.totals.total).toBe(170_000);
    expect(report.availableYears).toEqual([2026, 2025]);
    // Sorted by name
    expect(report.members.map(member => member.memberName)).toEqual(['Abel Bwire', 'Jane Smith']);
  });
});
