const express = require('express');
const router = express.Router();
const ThreadService = require('../services/ThreadService');
const MessageService = require('../services/MessageService');

router.get('/', async (req, res) => {
  try {
    const threads = await ThreadService.getThreadsForUser(req.user.id);
    res.json(threads);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/messages', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const result = await MessageService.getHistory(req.params.id, req.user.id, req.query.before || null, limit);
    res.json(result);
  } catch (err) {
    if (err.code === 'NOT_PARTICIPANT') return res.status(403).json({ code: err.code, message: err.message });
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
