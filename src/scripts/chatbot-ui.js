// src/scripts/chatbot-ui.js
// Educational AMR Chatbot UI - ISOLATED & OPTIONAL

let chatModal = null;
let chatMessages = null;
let chatInput = null;
let questionsRemaining = 10;

const BACKEND_URL = 'http://localhost:3001';
const MAX_MESSAGE_LENGTH = 300;

/**
 * Initialize chatbot UI
 */
export function initChatbot() {
  try {
    // Create chat button
    const chatButton = document.createElement('button');
    chatButton.id = 'chatbotToggle';
    chatButton.innerHTML = '💬';
    chatButton.title = 'AMR Education Assistant';
    chatButton.className = 'chatbot-toggle';
    document.body.appendChild(chatButton);
    
    // Create chat modal
    createChatModal();
    
    // Event listeners
    chatButton.addEventListener('click', toggleChat);
    
    console.log('✅ Chatbot UI initialized (optional feature)');
  } catch (error) {
    console.warn('⚠️ Chatbot UI failed to initialize (non-critical):', error);
  }
}

/**
 * Create chat modal HTML
 */
function createChatModal() {
  chatModal = document.createElement('div');
  chatModal.id = 'chatbotModal';
  chatModal.className = 'chatbot-modal hidden';
  
  chatModal.innerHTML = `
    <div class="chatbot-container">
      <div class="chatbot-header">
        <div>
          <h3>🦠 AMR Education Assistant</h3>
          <p class="chatbot-subtitle">Educational information only, not medical advice</p>
        </div>
        <button class="chatbot-close" id="chatbotClose">✕</button>
      </div>
      
      <div class="chatbot-messages" id="chatbotMessages">
        <div class="chatbot-message assistant">
          <div class="message-content">
            Hello! I'm here to answer educational questions about antimicrobial resistance (AMR). 
            I cannot provide medical advice, diagnoses, or prescriptions.
            <br><br>
            <strong>Try asking:</strong><br>
            • What is antimicrobial resistance?<br>
            • Why is AMR a global health threat?<br>
            • How do bacteria become resistant?<br>
            <br>
            <em>You have ${questionsRemaining} questions remaining today.</em>
          </div>
        </div>
      </div>
      
      <div class="chatbot-input-area">
        <textarea 
          id="chatbotInput" 
          placeholder="Ask an educational question about AMR..." 
          maxlength="${MAX_MESSAGE_LENGTH}"
          rows="2"
        ></textarea>
        <button id="chatbotSend" class="chatbot-send-btn">Send</button>
      </div>
      
      <div class="chatbot-footer">
        <small>Powered by AI • Educational purposes only • ${questionsRemaining}/10 questions remaining</small>
      </div>
    </div>
  `;
  
  document.body.appendChild(chatModal);
  
  // Get references
  chatMessages = document.getElementById('chatbotMessages');
  chatInput = document.getElementById('chatbotInput');
  
  // Event listeners
  document.getElementById('chatbotClose').addEventListener('click', toggleChat);
  document.getElementById('chatbotSend').addEventListener('click', sendMessage);
  
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

/**
 * Toggle chat modal
 */
function toggleChat() {
  chatModal.classList.toggle('hidden');
  if (!chatModal.classList.contains('hidden')) {
    chatInput.focus();
  }
}

/**
 * Add message to chat
 */
function addMessage(content, isUser = false) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `chatbot-message ${isUser ? 'user' : 'assistant'}`;
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.textContent = content;
  
  messageDiv.appendChild(contentDiv);
  chatMessages.appendChild(messageDiv);
  
  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Show loading indicator
 */
function showLoading() {
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'chatbot-message assistant';
  loadingDiv.id = 'chatbotLoading';
  loadingDiv.innerHTML = '<div class="message-content">🤔 Thinking...</div>';
  chatMessages.appendChild(loadingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Remove loading indicator
 */
function removeLoading() {
  const loading = document.getElementById('chatbotLoading');
  if (loading) {
    loading.remove();
  }
}

/**
 * Send message to backend
 */
async function sendMessage() {
  const question = chatInput.value.trim();
  
  if (!question) {
    return;
  }
  
  if (question.length > MAX_MESSAGE_LENGTH) {
    alert(`Question too long (max ${MAX_MESSAGE_LENGTH} characters)`);
    return;
  }
  
  // Add user message
  addMessage(question, true);
  chatInput.value = '';
  
  // Show loading
  showLoading();
  
  try {
    // Get auth token if available
    let headers = {
      'Content-Type': 'application/json'
    };
    
    if (window.supabase) {
      try {
        const { data: { session } } = await window.supabase.auth.getSession();
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
      } catch (authError) {
        // Ignore auth errors
        console.log('Auth not available for chatbot');
      }
    }
    
    // Call backend
    const response = await fetch(`${BACKEND_URL}/api/chatbot/ask`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ question })
    });
    
    const data = await response.json();
    
    removeLoading();
    
    if (!response.ok || !data.ok) {
      addMessage(`❌ ${data.error || 'Failed to get response'}`, false);
      return;
    }
    
    // Add assistant response
    addMessage(data.answer, false);
    
    // Update remaining questions count
    if (data.questionsRemaining !== undefined) {
      questionsRemaining = data.questionsRemaining;
      updateFooter();
    }
    
  } catch (error) {
    removeLoading();
    console.error('Chatbot error:', error);
    addMessage('❌ Chatbot is temporarily unavailable. Core system unaffected.', false);
  }
}

/**
 * Update footer with remaining questions
 */
function updateFooter() {
  const footer = chatModal.querySelector('.chatbot-footer small');
  if (footer) {
    footer.textContent = `Powered by AI • Educational purposes only • ${questionsRemaining}/10 questions remaining`;
  }
}

// Auto-init on load (safe - fails silently if error)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChatbot);
} else {
  initChatbot();
}
