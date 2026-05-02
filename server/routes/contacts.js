const express = require('express');
const router = express.Router();
const ContactService = require('../services/ContactService');

router.post('/request', async (req, res) => {
  try {
    const result = await ContactService.sendRequest(req.user.id, req.body.recipient_id, req.body.message);
    res.status(201).json(result);
  } catch (err) {
    if (err.code === 'DUPLICATE_REQUEST') return res.status(409).json({ code: err.code, message: err.message });
    res.status(500).json({ message: err.message });
  }
});

router.get('/requests', async (req, res) => {
  try {
    const requests = await ContactService.getPendingRequests(req.user.id);
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/requests/:id/accept', async (req, res) => {
  try {
    const thread = await ContactService.acceptRequest(req.params.id, req.user.id);
    res.json(thread);
  } catch (err) {
    if (err.code === 'FORBIDDEN') return res.status(403).json({ code: err.code, message: err.message });
    res.status(500).json({ message: err.message });
  }
});

router.patch('/requests/:id/reject', async (req, res) => {
  try {
    const result = await ContactService.rejectRequest(req.params.id, req.user.id);
    res.json(result);
  } catch (err) {
    if (err.code === 'FORBIDDEN') return res.status(403).json({ code: err.code, message: err.message });
    res.status(500).json({ message: err.message });
  }
});

router.delete('/requests/:id', async (req, res) => {
  try {
    await ContactService.cancelRequest(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'FORBIDDEN') return res.status(403).json({ code: err.code, message: err.message });
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
