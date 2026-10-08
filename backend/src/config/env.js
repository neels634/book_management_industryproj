const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toNumber = (value, fallback) => {
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const nodeEnv = process.env.NODE_ENV || 'development';

const config = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: toInt(process.env.PORT, 5000),
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  bcryptRounds: toInt(process.env.BCRYPT_SALT_ROUNDS, 10),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  trustProxy: toInt(process.env.TRUST_PROXY, 0),
  timezone: process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  rateLimit: {
    windowMs: toInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: toInt(process.env.RATE_LIMIT_MAX, 500),
    authMax: toInt(process.env.AUTH_RATE_LIMIT_MAX, 10),
  },
  // Initial values for the library settings document. Once the settings
  // document exists, an ADMIN changes these from the Settings screen.
  librarySettingDefaults: {
    libraryName: process.env.LIBRARY_NAME || 'City Central Library',
    currency: process.env.DEFAULT_CURRENCY || 'INR',
    finePerDay: toNumber(process.env.DEFAULT_FINE_PER_DAY, 5),
    loanPeriodDays: toInt(process.env.DEFAULT_LOAN_PERIOD_DAYS, 14),
    defaultBorrowingLimit: toInt(process.env.DEFAULT_BORROWING_LIMIT, 3),
  },
};

function validateConfig() {
  const missing = ['MONGODB_URI', 'JWT_SECRET'].filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}. See .env.example.`);
  }
  if (config.isProduction && config.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production.');
  }
}

module.exports = config;
module.exports.validateConfig = validateConfig;
