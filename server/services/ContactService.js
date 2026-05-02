const ContactRequest = require('../models/ContactRequest');
const ThreadService = require('./ThreadService');

function appError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

async function sendRequest(senderId, recipientId, message = '') {
  const existing = await ContactRequest.findOne({ sender_id: senderId, recipient_id: recipientId });
  if (existing) throw appError('DUPLICATE_REQUEST', 'Contact request already exists');
  return ContactRequest.create({ sender_id: senderId, recipient_id: recipientId, message });
}

async function acceptRequest(requestId, userId) {
  const req = await ContactRequest.findById(requestId);
  if (!req || req.recipient_id.toString() !== userId.toString()) {
    throw appError('FORBIDDEN', 'Not authorized to accept this request');
  }
  req.status = 'accepted';
  await req.save();
  return ThreadService.createThread(req.sender_id, req.recipient_id);
}

async function rejectRequest(requestId, userId) {
  const req = await ContactRequest.findById(requestId);
  if (!req || req.recipient_id.toString() !== userId.toString()) {
    throw appError('FORBIDDEN', 'Not authorized to reject this request');
  }
  req.status = 'rejected';
  return req.save();
}

async function cancelRequest(requestId, userId) {
  const req = await ContactRequest.findById(requestId);
  if (!req || req.sender_id.toString() !== userId.toString() || req.status !== 'pending') {
    throw appError('FORBIDDEN', 'Cannot cancel this request');
  }
  await req.deleteOne();
}

async function getPendingRequests(userId) {
  return ContactRequest.find({ recipient_id: userId, status: 'pending' }).populate('sender_id', 'name photo_url');
}

module.exports = { sendRequest, acceptRequest, rejectRequest, cancelRequest, getPendingRequests };
