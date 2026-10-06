const router = require('express').Router();
const { analyzeClothing } = require('../services/aiService');
const { answer } = require('../services/chatService');
const { GeminiError } = require('../services/geminiService');
const { getSupabase, sendSupabaseError } = require('../config/supabase');

router.post('/analyze', (req, res) => {
  const result = analyzeClothing(req.body?.condition, req.body?.category);
  return res.json({ ...result, demo: true, analyzedAt: new Date() });
});

router.post('/chat', async (req, res) => {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!message) return res.status(400).json({ message: 'Message is required' });
  if (message.length > 1000) return res.status(400).json({ message: 'Message must be 1000 characters or fewer' });
  const history = Array.isArray(req.body?.history)
    ? req.body.history
      .filter((item) => (item?.role === 'user' || item?.role === 'assistant') && typeof item.content === 'string')
      .slice(-10)
      .map((item) => ({ role: item.role, content: item.content.slice(0, 1000) }))
    : [];

  try {
    return res.json(await answer(message, getSupabase, history));
  } catch (error) {
    if (error instanceof GeminiError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return sendSupabaseError(res, error);
  }
});

module.exports = router;
