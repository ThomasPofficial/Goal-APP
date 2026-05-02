const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  thread_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Thread', required: true },
  sender_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, maxlength: 2000 },
  timestamp: { type: Date, default: Date.now },
  read_by: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
});

messageSchema.index({ thread_id: 1, timestamp: -1 });

module.exports = mongoose.model('Message', messageSchema);
