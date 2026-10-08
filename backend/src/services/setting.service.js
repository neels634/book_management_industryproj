const config = require('../config/env');
const { Setting } = require('../models');
const ApiError = require('../utils/ApiError');

/**
 * Returns the settings document, creating it from env defaults on first use.
 * Read it before starting a transaction, not inside one: the upsert would
 * otherwise make every loan transaction contend on this single document.
 */
async function getSettings() {
  return Setting.findOneAndUpdate(
    { key: 'global' },
    { $setOnInsert: { key: 'global', ...config.librarySettingDefaults } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

async function updateSettings(changes, actor) {
  const current = await getSettings();
  const loan = changes.loanPeriodDays ?? current.loanPeriodDays;
  const maxLoan = changes.maxLoanPeriodDays ?? current.maxLoanPeriodDays;
  if (loan > maxLoan) {
    throw ApiError.badRequest('Loan period cannot be longer than the maximum loan period', 'INVALID_LOAN_PERIOD');
  }
  return Setting.findOneAndUpdate(
    { key: 'global' },
    { $set: { ...changes, updatedBy: actor.id } },
    { new: true, runValidators: true }
  );
}

module.exports = { getSettings, updateSettings };
