const mongoose = require('mongoose');
const { MEMBER_STATUS, MEMBERSHIP_TYPES } = require('../utils/constants');

const memberSchema = new mongoose.Schema(
  {
    memberId: { type: String, required: true, unique: true, immutable: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, trim: true, lowercase: true, maxlength: 120, default: '' },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    address: { type: String, trim: true, maxlength: 300, default: '' },
    membershipType: { type: String, enum: MEMBERSHIP_TYPES, default: 'PUBLIC' },
    membershipDate: { type: Date, default: Date.now },
    membershipExpiry: { type: Date, default: null },
    membershipStatus: { type: String, enum: Object.values(MEMBER_STATUS), default: MEMBER_STATUS.ACTIVE },
    borrowingLimit: { type: Number, required: true, min: 1, max: 50, validate: Number.isInteger },
    currentBorrowedCount: { type: Number, default: 0, min: 0, validate: Number.isInteger },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, toJSON: { versionKey: false } }
);

// E-mail is optional, but when given it must be unique.
memberSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $gt: '' } } });
memberSchema.index({ name: 1 });
memberSchema.index({ membershipStatus: 1 });

module.exports = mongoose.model('Member', memberSchema);
