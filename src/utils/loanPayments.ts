import type { Account, Loan, Transaction, User } from '../types/index.js';
import { localYearMonth, memberAvatar, memberName, round, sum } from './periods.js';

const OPEN_STATUSES = new Set(['ACTIVE', 'DEFAULTED']);
// Applications never became loans
const APPLICATION_STATUSES = new Set(['PENDING', 'REJECTED']);

type LoanWithSummary = Loan & { updatedAt?: string };

interface LoanPaymentRow {
    loanId: string;
    accountNumber: string;
    memberName: string;
    memberAvatar: string | null;
    loanAmount: number;
    broughtForward: number;
    months: number[];
    totalPaid: number;
    remainingBalance: number;
    status: string;
    completedOn: string | null;
    startDate: string;
}

const byDate = (a: Transaction, b: Transaction) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

// For a PAID loan: the payment at which completed payments covered principal + interest.
// Falls back to the loan's last update (e.g. loans marked PAID before payments were recorded).
const completionDate = (loan: LoanWithSummary, completedPayments: Transaction[]) => {
    if (loan.status !== 'PAID') return null;
    const totalOwed = Number(loan.amount) + Number(loan.summary?.totalInterest || 0);
    let running = 0;
    for (const payment of completedPayments) {
        running += Number(payment.amount) || 0;
        if (running >= totalOwed) return payment.createdAt;
    }
    return loan.updatedAt || null;
};

// Loan payments timeline: one row per loan, LOAN_PAYMENT transactions collated by month.
// COMPLETED payments count toward the figures; PENDING ones are reported separately in the stats.
export const buildLoanPaymentsReport = (
    transactions: Transaction[],
    loans: LoanWithSummary[],
    accounts: Account[],
    users: User[],
    year: number,
    month: number | null,
) => {
    const usersById = new Map(users.map(user => [user.id, user]));
    const accountsById = new Map(accounts.map(account => [account.id, account]));
    const paymentsByLoan = new Map<string, Transaction[]>();
    for (const transaction of transactions) {
        if (transaction.type !== 'LOAN_PAYMENT' || !transaction.loanId || !transaction.createdAt) continue;
        const list = paymentsByLoan.get(transaction.loanId) || [];
        list.push(transaction);
        paymentsByLoan.set(transaction.loanId, list);
    }

    const isInPeriod = (date: { year: number, month: number }) => date.year === year && (!month || date.month === month);
    const years = new Set<number>([year]);
    const periodAmounts: number[] = [];
    let pendingRepaid = 0;
    let pendingCount = 0;
    let loansCompleted = 0;
    let outstandingBalance = 0;

    const rows: LoanPaymentRow[] = [];
    for (const loan of loans) {
        if (APPLICATION_STATUSES.has(loan.status)) continue;
        const payments = (paymentsByLoan.get(loan.id) || []).sort(byDate);
        const completedPayments = payments.filter(payment => payment.status === 'COMPLETED');
        const completedOn = completionDate(loan, completedPayments);
        const remainingBalance = Number(loan.summary?.remainingBalance || 0);

        // Outstanding is "as of now" across every open loan, whatever year is shown
        if (OPEN_STATUSES.has(loan.status)) outstandingBalance += remainingBalance;
        if (completedOn && isInPeriod(localYearMonth(completedOn))) loansCompleted += 1;

        const startYear = loan.startDate ? localYearMonth(loan.startDate).year : year;
        years.add(startYear);
        // Show loans that existed in the year and were not already finished before it
        if (startYear > year) continue;
        if (completedOn && localYearMonth(completedOn).year < year) continue;

        const months = new Array<number>(12).fill(0);
        let broughtForward = 0;
        for (const payment of payments) {
            const amount = Number(payment.amount) || 0;
            const date = localYearMonth(payment.createdAt);
            years.add(date.year);
            if (payment.status === 'PENDING') {
                if (isInPeriod(date)) {
                    pendingRepaid += amount;
                    pendingCount += 1;
                }
                continue;
            }
            if (payment.status !== 'COMPLETED') continue;
            if (date.year < year) broughtForward += amount;
            else if (date.year === year) months[date.month - 1] += amount;
            if (isInPeriod(date)) periodAmounts.push(amount);
        }

        const account = accountsById.get(loan.accountId);
        rows.push({
            loanId: loan.id,
            accountNumber: account?.accountNumber || '',
            memberName: memberName(account ? usersById.get(account.userId) : undefined),
            memberAvatar: memberAvatar(account ? usersById.get(account.userId) : undefined),
            loanAmount: round(Number(loan.amount) || 0),
            broughtForward: round(broughtForward),
            months: months.map(round),
            // Cumulative repaid up to the end of the report year
            totalPaid: round(broughtForward + sum(months)),
            remainingBalance: round(remainingBalance),
            status: loan.status,
            completedOn: completedOn ? new Date(completedOn).toISOString() : null,
            startDate: loan.startDate,
        });
    }

    rows.sort((a, b) => a.memberName.localeCompare(b.memberName)
        || new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    return {
        year,
        month,
        availableYears: [...years].sort((a, b) => b - a),
        stats: {
            totalRepaid: round(sum(periodAmounts)),
            paymentCount: periodAmounts.length,
            pendingRepaid: round(pendingRepaid),
            pendingCount,
            outstandingBalance: round(outstandingBalance),
            loansCompleted,
        },
        loans: rows.map(({ startDate, ...row }) => row),
        totals: {
            loanAmount: round(sum(rows.map(row => row.loanAmount))),
            broughtForward: round(sum(rows.map(row => row.broughtForward))),
            months: Array.from({ length: 12 }, (_, index) => round(sum(rows.map(row => row.months[index])))),
            totalPaid: round(sum(rows.map(row => row.totalPaid))),
            remainingBalance: round(sum(rows.map(row => row.remainingBalance))),
        },
    };
};
