process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-testing-purposes';
process.env.JWT_EXPIRES_IN = '1h';
process.env.BCRYPT_SALT_ROUNDS = '4';
process.env.DEFAULT_FINE_PER_DAY = '5';
process.env.DEFAULT_LOAN_PERIOD_DAYS = '14';
process.env.DEFAULT_BORROWING_LIMIT = '3';
