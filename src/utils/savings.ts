import type { Account, Transaction, User } from '../types/index.js';
import { localYearMonth, median, memberAvatar, memberName, round, sum } from './periods.js';

export const buildSavingsReport = (
    transactions: Transaction[],
    accounts: Account[],
    users: User[],
    year: number,
    month: number | null,
) => {
    const usersById = new Map(users.map(user => [user.id, user]));
    const rows = new Map(accounts.map(account => [account.id, {
        accountId: account.id,
        accountNumber: account.accountNumber,
        memberName: memberName(usersById.get(account.userId)),
        memberAvatar: memberAvatar(usersById.get(account.userId)),
        broughtForward: 0,
        months: new Array<number>(12).fill(0),
        total: 0,
    }]));

    const periodAmounts: number[] = [];
    const periodTotalsByAccount = new Map<string, number>();
    const years = new Set<number>([year]);
    let pendingSavings = 0;
    let pendingCount = 0;

    for (const transaction of transactions) {
        if (transaction.type !== 'SAVINGS_DEPOSIT') continue;
        // Deposits on deleted accounts have no row and are left out
        const row = rows.get(transaction.accountId);
        if (!row || !transaction.createdAt) continue;

        const amount = Number(transaction.amount) || 0;
        const date = localYearMonth(transaction.createdAt);
        const inPeriod = date.year === year && (!month || date.month === month);

        if (transaction.status === 'PENDING') {
            years.add(date.year);
            if (inPeriod) {
                pendingSavings += amount;
                pendingCount += 1;
            }
            continue;
        }
        if (transaction.status !== 'COMPLETED') continue;

        years.add(date.year);
        if (date.year < year) {
            row.broughtForward += amount;
        } else if (date.year === year) {
            row.months[date.month - 1] += amount;
        }

        if (inPeriod) {
            periodAmounts.push(amount);
            periodTotalsByAccount.set(row.accountId, (periodTotalsByAccount.get(row.accountId) || 0) + amount);
        }
    }

    const members = [...rows.values()]
        .map(row => ({
            ...row,
            broughtForward: round(row.broughtForward),
            months: row.months.map(round),
            total: round(row.broughtForward + sum(row.months)),
        }))
        .sort((a, b) => a.memberName.localeCompare(b.memberName));

    const totalSavings = sum(periodAmounts);

    return {
        year,
        month,
        availableYears: [...years].sort((a, b) => b - a),
        stats: {
            totalSavings: round(totalSavings),
            transactionCount: periodAmounts.length,
            pendingSavings: round(pendingSavings),
            pendingCount,
            highestTotalSaved: round(Math.max(0, ...periodTotalsByAccount.values())),
            meanAmount: round(periodAmounts.length ? totalSavings / periodAmounts.length : 0),
            medianAmount: round(median(periodAmounts)),
        },
        members,
        totals: {
            broughtForward: round(sum(members.map(member => member.broughtForward))),
            months: Array.from({ length: 12 }, (_, index) => round(sum(members.map(member => member.months[index])))),
            total: round(sum(members.map(member => member.total))),
        },
    };
};
