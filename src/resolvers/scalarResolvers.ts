import { GraphQLError, GraphQLScalarType, Kind } from 'graphql';

// Whole shillings beyond Int's 32-bit limit, kept within the range JavaScript numbers represent exactly
const toMoney = (value: unknown): number => {
    // Integer strings are accepted in case the database layer returns BIGINT as text
    const number = typeof value === 'string' && /^-?\d+$/.test(value.trim()) ? Number(value) : value;
    if (typeof number !== 'number' || !Number.isSafeInteger(number)) {
        throw new GraphQLError(`Money must be a whole number of shillings up to ${Number.MAX_SAFE_INTEGER}: ${String(value)}`);
    }
    return number;
};

// Free-form data (audit trail request details): passed through as it is
const toJson = (value: unknown) => value;

export default {
    JSON: new GraphQLScalarType({
        name: 'JSON',
        description: 'Any JSON value',
        serialize: toJson,
        parseValue: toJson,
        parseLiteral: () => {
            throw new GraphQLError('JSON literals are not supported; pass a variable');
        },
    }),
    Money: new GraphQLScalarType({
        name: 'Money',
        description: 'Whole Uganda shillings, 64-bit backed (exact up to 9,007,199,254,740,991)',
        serialize: toMoney,
        parseValue: toMoney,
        parseLiteral: (ast) => {
            if (ast.kind !== Kind.INT) {
                throw new GraphQLError('Money literals must be whole numbers', { nodes: ast });
            }
            return toMoney(Number(ast.value));
        },
    }),
};
