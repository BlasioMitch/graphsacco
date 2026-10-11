// Read by utils/auth.ts when it is imported, so set before any test file loads
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.INTERNAL_API_KEY = 'test-internal-key';
