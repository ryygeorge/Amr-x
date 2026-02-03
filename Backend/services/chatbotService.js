// Backend/services/chatbotService.js
// Educational AMR chatbot service using HuggingFace Inference API

import dotenv from 'dotenv';
dotenv.config();

// Safety configuration
const FORBIDDEN_KEYWORDS = [
  'prescribe', 'dosage', 'treat me', 'cure', 'which antibiotic', 
  'medicine for', 'what should i take', 'recommend drug', 
  'diagnose', 'prescription', 'my symptoms'
];

const MAX_INPUT_LENGTH = 300;
const MAX_OUTPUT_TOKENS = 200;
const REQUEST_TIMEOUT = 8000; // 8 seconds

// In-memory rate limiting (simple implementation)
const userQuestionCounts = new Map();
const MAX_QUESTIONS_PER_DAY = 5;

/**
 * Check if user has exceeded rate limit
 */
function checkRateLimit(userId) {
  const today = new Date().toDateString();
  const key = `${userId}_${today}`;
  
  const count = userQuestionCounts.get(key) || 0;
  
  if (count >= MAX_QUESTIONS_PER_DAY) {
    return {
      allowed: false,
      remaining: 0,
      message: 'Daily question limit reached (5/day). Please try again tomorrow.'
    };
  }
  
  userQuestionCounts.set(key, count + 1);
  
  return {
    allowed: true,
    remaining: MAX_QUESTIONS_PER_DAY - (count + 1),
    message: null
  };
}

/**
 * Validate user question for safety
 */
function validateQuestion(question) {
  if (!question || typeof question !== 'string') {
    return { valid: false, error: 'Question must be a non-empty string' };
  }
  
  const trimmed = question.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, error: 'Question cannot be empty' };
  }
  
  if (trimmed.length > MAX_INPUT_LENGTH) {
    return { valid: false, error: `Question too long (max ${MAX_INPUT_LENGTH} characters)` };
  }
  
  // Check for forbidden keywords
  const lowerQuestion = trimmed.toLowerCase();
  for (const keyword of FORBIDDEN_KEYWORDS) {
    if (lowerQuestion.includes(keyword)) {
      return { 
        valid: false, 
        error: 'This chatbot provides educational information only, not medical advice or prescriptions. Please consult a healthcare professional for treatment decisions.' 
      };
    }
  }
  
  return { valid: true, question: trimmed };
}

/**
 * Call HuggingFace Inference API
 */
async function callHuggingFace(question) {
  const HF_API_KEY = process.env.HF_API_KEY;
  
  if (!HF_API_KEY) {
    throw new Error('HF_API_KEY not configured');
  }
  
  const modelEndpoint = 'https://api-inference.huggingface.co/models/google/flan-t5-base';
  
  // Format the question for educational context
  const formattedInput = `Answer this educational question about antimicrobial resistance in 2-3 sentences: ${question}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  
  try {
    const response = await fetch(modelEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: formattedInput,
        parameters: {
          max_new_tokens: MAX_OUTPUT_TOKENS,
          temperature: 0.7,
          top_p: 0.9
        }
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('HuggingFace API error:', response.status, errorText);
      
      if (response.status === 503) {
        throw new Error('Model is loading, please try again in a moment');
      }
      
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // HuggingFace returns array of results
    if (Array.isArray(data) && data.length > 0 && data[0].generated_text) {
      return data[0].generated_text;
    }
    
    throw new Error('Unexpected response format from model');
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - please try a simpler question');
    }
    
    throw error;
  }
}

/**
 * Main chatbot service function
 */
async function askChatbot(question, userId = 'anonymous') {
  try {
    // 1. Validate question
    const validation = validateQuestion(question);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      };
    }
    
    // 2. Check rate limit
    const rateLimit = checkRateLimit(userId);
    if (!rateLimit.allowed) {
      return {
        success: false,
        error: rateLimit.message,
        rateLimitExceeded: true
      };
    }
    
    // 3. Call HuggingFace API
    const rawAnswer = await callHuggingFace(validation.question);
    
    // 4. Add disclaimer
    const disclaimer = "\n\n⚠️ This assistant provides educational information only, not medical advice.";
    const answer = rawAnswer + disclaimer;
    
    // 5. Return successful response
    return {
      success: true,
      answer: answer,
      questionsRemaining: rateLimit.remaining
    };
    
  } catch (error) {
    console.error('Chatbot service error:', error);
    
    // Safe fallback - don't expose internal errors
    return {
      success: false,
      error: 'Chatbot is temporarily unavailable. Core system unaffected.',
      technicalDetails: process.env.NODE_ENV === 'development' ? error.message : undefined
    };
  }
}

export { askChatbot };
