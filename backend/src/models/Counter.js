const mongoose = require('mongoose');

/** Sequence generator for human-readable IDs (BK-00001, MEM-00001, TXN-000001). */
const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false }
);

module.exports = mongoose.model('Counter', counterSchema);
