const mongoose = require('mongoose');
const { CATEGORY_STATUS } = require('../utils/constants');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    status: { type: String, enum: Object.values(CATEGORY_STATUS), default: CATEGORY_STATUS.ACTIVE },
  },
  { timestamps: true, toJSON: { versionKey: false } }
);

// Case-insensitive uniqueness: "Fiction" and "fiction" are the same category.
categorySchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

module.exports = mongoose.model('Category', categorySchema);
