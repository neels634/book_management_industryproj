const mongoose = require('mongoose');
const { TXN_STATUS, FINE_STATUS, RETURN_CONDITION } = require('../utils/constants');
const { calculateOverdueDays, calculateOverdueFine } = require('../utils/fine');

const { ObjectId } = mongoose.Schema.Types;

/**
 * A loan of one copy of a book to one member. Records are never deleted:
 * they are the library's audit trail and the source for every report.
 *
 * "Overdue" is not stored - it is derived (status ISSUED and dueDate passed)
 * so it can never go stale.
 */
const transactionSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, unique: true, immutable: true },
    book: { type: ObjectId, ref: 'Book', required: true },
    member: { type: ObjectId, ref: 'Member', required: true },
    issuedBy: { type: ObjectId, ref: 'User', required: true },
    returnedTo: { type: ObjectId, ref: 'User', default: null },
    issueDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    returnDate: { type: Date, default: null },
    lostReportedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: [TXN_STATUS.ISSUED, TXN_STATUS.RETURNED, TXN_STATUS.LOST],
      default: TXN_STATUS.ISSUED,
    },
    renewCount: { type: Number, default: 0, min: 0 },
    // Fine rate in force when the book was issued (rates may change later).
    finePerDay: { type: Number, required: true, min: 0 },
    overdueDays: { type: Number, default: 0, min: 0 },
    fine: { type: Number, default: 0, min: 0 },
    fineBreakdown: {
      overdue: { type: Number, default: 0 },
      damage: { type: Number, default: 0 },
      lost: { type: Number, default: 0 },
    },
    fineStatus: { type: String, enum: Object.values(FINE_STATUS), default: FINE_STATUS.NONE },
    fineAssessedAt: { type: Date, default: null },
    fineSettledAt: { type: Date, default: null },
    fineSettledBy: { type: ObjectId, ref: 'User', default: null },
    returnCondition: { type: String, enum: [...Object.values(RETURN_CONDITION), null], default: null },
    remarks: { type: String, trim: true, maxlength: 500, default: '' },
  },
  {
    timestamps: true,
    id: false,
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true },
  }
);

transactionSchema.virtual('isOverdue').get(function isOverdue() {
  return this.status === TXN_STATUS.ISSUED && this.dueDate < new Date();
});

transactionSchema.virtual('displayStatus').get(function displayStatus() {
  return this.isOverdue ? TXN_STATUS.OVERDUE : this.status;
});

/** Overdue days so far for open loans, or the final figure for closed ones. */
transactionSchema.virtual('currentOverdueDays').get(function currentOverdueDays() {
  return this.status === TXN_STATUS.ISSUED ? calculateOverdueDays(this.dueDate) : this.overdueDays;
});

/** Fine accrued so far for open loans, or the assessed fine for closed ones. */
transactionSchema.virtual('accruedFine').get(function accruedFine() {
  return this.status === TXN_STATUS.ISSUED
    ? calculateOverdueFine(calculateOverdueDays(this.dueDate), this.finePerDay)
    : this.fine;
});

transactionSchema.index({ member: 1, status: 1 });
transactionSchema.index({ book: 1, status: 1 });
transactionSchema.index({ status: 1, dueDate: 1 });
transactionSchema.index({ issueDate: -1 });
transactionSchema.index({ fineStatus: 1 });
// A member may hold at most one open loan of the same title at a time. Enforced
// by the database, so two simultaneous requests cannot both succeed.
transactionSchema.index(
  { book: 1, member: 1 },
  { unique: true, partialFilterExpression: { status: TXN_STATUS.ISSUED }, name: 'one_open_loan_per_title' }
);

module.exports = mongoose.model('Transaction', transactionSchema);
