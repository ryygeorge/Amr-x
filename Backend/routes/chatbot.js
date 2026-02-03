// Backend/routes/chatbot.js
// Chatbot API routes

import express from 'express';
import { askChatbot } from '../services/chatbotService.js';
import { supabase } from '../lib/supabase.js';

const router = express.Router();

/**
 * POST /api/chatbot/ask
 * Educational chatbot endpoint
 */
router.post('/ask', async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question) {
      return res.status(400).json({
        ok: false,
        error: 'Question is required'
      });
    }
    
    // Get user ID if available (optional)
    let userId = 'anonymous';
    const authHeader = req.headers.authorization;
    
    if (authHeader && supabase) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          userId = user.id;
        }
      } catch (authError) {
        // Ignore auth errors - allow anonymous access
        console.log('Auth check skipped:', authError.message);
      }
    }
    
    console.log(`📩 Chatbot question from ${userId}: "${question.substring(0, 50)}..."`);
    
    // Call chatbot service
    const result = await askChatbot(question, userId);
    
    if (!result.success) {
      return res.status(400).json({
        ok: false,
        error: result.error,
        rateLimitExceeded: result.rateLimitExceeded || false
      });
    }
    
    // Log to database (optional, non-blocking)
    if (supabase) {
      supabase
        .from('chatbot_logs')
        .insert({
          user_id: userId === 'anonymous' ? null : userId,
          question: question.substring(0, 300),
          created_at: new Date().toISOString()
        })
        .then(() => console.log('✅ Chatbot interaction logged'))
        .catch(err => console.warn('⚠️ Failed to log chatbot interaction:', err.message));
    }
    
    // Return successful response
    res.json({
      ok: true,
      answer: result.answer,
      questionsRemaining: result.questionsRemaining
    });
    
    console.log(`✅ Chatbot response sent (${result.questionsRemaining} questions remaining)`);
    
  } catch (error) {
    console.error('❌ Chatbot route error:', error);
    
    res.status(500).json({
      ok: false,
      error: 'Chatbot is temporarily unavailable. Core system unaffected.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/chatbot/health
 * Check if chatbot is available
 */
router.get('/health', (req, res) => {
  const hasApiKey = !!process.env.HF_API_KEY;
  
  res.json({
    ok: true,
    status: hasApiKey ? 'ready' : 'not_configured',
    message: hasApiKey 
      ? 'AMR Education Assistant is ready' 
      : 'HF_API_KEY not configured',
    model: 'google/flan-t5-base',
    disclaimer: 'Educational information only, not medical advice'
  });
});

export default router;
