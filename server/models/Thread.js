const mongoose = require('mongoose');

const threadSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    last_message: {
      sender_id: mongoose.Schema.Types.ObjectId,
      content: String,
      timestamp: Date,
    },
    unread_counts: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

threadSchema.index({ participants: 1 });

module.exports = mongoose.model('Thread', threadSchema);
// Note: updatedAt is suppressed via `updatedAt: false` to keep the schema clean
