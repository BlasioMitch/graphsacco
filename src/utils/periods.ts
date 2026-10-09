import { GraphQLError } from 'graphql';
import type { User } from '../types/index.js';

// Shared by the monthly timeline reports (savings, loan payments)

// Africa/Kampala (EAT) has no daylight saving, so a fixed offset buckets months correctly
const UTC_OFFSET_HOURS = 3;

// Shillings have no minor unit: every figure (including mean and median) is a whole number
export const round = (value: number) => Math.round(value);
export const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);

export const localYearMonth = (timestamp: string | Date) => {
    const local = new Date(new Date(timestamp).getTime() + UTC_OFFSET_HOURS * 60 * 60 * 1000);
    return { year: local.getUTCFullYear(), month: local.getUTCMonth() + 1 };
};

export const median = (values: number[]) => {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

export const memberName = (user?: User) => user
    ? [user.first_name, user.last_name, user.other_name].filter(Boolean).join(' ')
    : 'Unknown member';

// Rejects report periods outside a sensible range (BAD_USER_INPUT, like other argument errors)
export const validatePeriod = (year: number, month?: number | null) => {
    const badInput = (message: string) => new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        throw badInput('year must be between 2000 and 2100');
    }
    if (month != null && (!Number.isInteger(month) || month < 1 || month > 12)) {
        throw badInput('month must be between 1 and 12');
    }
};
