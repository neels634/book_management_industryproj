const mongoose = require('mongoose');

/** Single library-wide settings document (key: "global"). */
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'global', unique: true, immutable: true },
    libraryName: { type: String, trim: true, maxlength: 100, default: 'City Central Library' },
    currency: { type: String, trim: true, uppercase: true, minlength: 3, maxlength: 3, default: 'INR' },
    finePerDay: { type: Number, min: 0, default: 5 },
    loanPeriodDays: { type: Number, min: 1, max: 90, default: 14 },
    maxLoanPeriodDays: { type: Number, min: 1, max: 365, default: 60 },
    defaultBorrowingLimit: { type: Number, min: 1, max: 50, default: 3 },
    maxRenewals: { type: Number, min: 0, max: 10, default: 2 },
    lostBookFee: { type: Number, min: 0, default: 500 },
    damagedBookFee: { type: Number, min: 0, default: 100 },
    // Members whose unpaid fines exceed this amount cannot borrow.
    maxOutstandingFine: { type: Number, min: 0, default: 200 },
    blockBorrowingWhenOverdue: { type: Boolean, default: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, toJSON: { versionKey: false } }
);

module.exports = mongoose.model('Setting', settingSchema);
