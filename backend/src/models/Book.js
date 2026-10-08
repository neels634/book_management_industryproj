const mongoose = require('mongoose');
const { BOOK_STATUS } = require('../utils/constants');

const copyCount = { type: Number, default: 0, min: 0, validate: Number.isInteger };

/**
 * One document per title (ISBN). Physical copies are tracked as counters:
 *
 *   totalCopies = availableCopies + issuedCopies + damagedCopies + lostCopies
 *
 * Counters are only ever changed with atomic conditional $inc updates in the
 * services, so the invariant holds even under concurrent issue/return.
 */
const bookSchema = new mongoose.Schema(
  {
    bookId: { type: String, required: true, unique: true, immutable: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    subtitle: { type: String, trim: true, maxlength: 200, default: '' },
    isbn: { type: String, required: true, unique: true, trim: true },
    authors: {
      type: [{ type: String, trim: true, maxlength: 100 }],
      validate: [(v) => Array.isArray(v) && v.length > 0, 'At least one author is required'],
    },
    publisher: { type: String, trim: true, maxlength: 120, default: '' },
    publishedYear: { type: Number, min: 1000, max: 9999 },
    edition: { type: String, trim: true, maxlength: 40, default: '' },
    language: { type: String, trim: true, maxlength: 40, default: 'English' },
    pages: { type: Number, min: 1 },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    shelfLocation: { type: String, trim: true, maxlength: 40, default: '' },
    // Replacement cost, charged when a copy is reported lost.
    price: { type: Number, min: 0, default: 0 },
    totalCopies: { ...copyCount, required: true },
    availableCopies: copyCount,
    issuedCopies: copyCount,
    damagedCopies: copyCount,
    lostCopies: copyCount,
    status: { type: String, enum: Object.values(BOOK_STATUS), default: BOOK_STATUS.ACTIVE },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { versionKey: false } }
);

bookSchema.pre('validate', function checkInventory(next) {
  const accounted = this.availableCopies + this.issuedCopies + this.damagedCopies + this.lostCopies;
  if (accounted !== this.totalCopies) {
    this.invalidate('totalCopies', 'Copy counters are inconsistent with total copies');
  }
  next();
});

bookSchema.index({ title: 1 });
bookSchema.index({ authors: 1 });
bookSchema.index({ category: 1, status: 1 });
bookSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Book', bookSchema);
