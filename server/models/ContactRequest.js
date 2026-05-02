const mongoose = require('mongoose');

const contactRequestSchema = new mongoose.Schema(
  {
    sender_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, maxlength: 500, default: '' },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

contactRequestSchema.index({ sender_id: 1, recipient_id: 1 }, { unique: true });

module.exports = mongoose.model('ContactRequest', contactRequestSchema);
