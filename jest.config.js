/** @type {import('ts-jest').JestConfigWithTsJest} **/
// Gateway tests: real schema and resolvers, with the REST API replaced by a fake (src/__tests__/support)
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true, tsconfig: { types: ['node', 'jest'] } }],
  },
  testMatch: ['<rootDir>/src/__tests__/**/*.test.ts'],
  setupFiles: ['<rootDir>/src/__tests__/support/env.ts'],
};
