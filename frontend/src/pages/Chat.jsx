import { useState, useEffect, useRef } from 'react';
import { sendChat, getChatSuggestions } from '../api';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [filterStatus, setFilterStatus] = useState('');
  
  const messagesEndRef = useRef(null);

  // Fetch suggestions on mount
  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const data = await getChatSuggestions();
        setSuggestions(data.suggestions || []);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
      }
    };

    fetchSuggestions();
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Submit handler
  const handleSubmit = async (e) => {
    e?.preventDefault();
    
    if (!input.trim()) return;

    const userMessage = input;
    
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setLoading(true);

    try {
      const response = await sendChat(
        userMessage, 
        null, 
        filterStatus || null
      );
      
      // Add assistant message
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.answer,
        sources: response.sources
      }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your question. Please try again.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion) => {
    setInput(suggestion);
    // Submit immediately
    setTimeout(() => {
      handleSubmit();
    }, 0);
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <h1 className="page-title" style={{ margin: 0 }}>Biodiversity Chat</h1>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '14px', fontWeight: '500' }}>Filter by status:</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              padding: '6px 10px',
              fontSize: '14px',
              border: '1px solid #e0e0e0',
              borderRadius: '6px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="">All</option>
            <option value="CR">CR only</option>
            <option value="EN">EN only</option>
            <option value="VU">VU only</option>
          </select>
        </div>
      </div>

      {/* Message List */}
      <div 
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          marginBottom: '16px',
          minHeight: 0
        }}
      >
        {/* Suggestion Chips (only when no messages) */}
        {messages.length === 0 && suggestions.length > 0 && (
          <div>
            <p style={{ 
              fontSize: '14px', 
              fontWeight: '500', 
              marginBottom: '12px',
              color: '#555'
            }}>
              Try asking:
            </p>
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '8px',
              marginBottom: '24px'
            }}>
              {suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestionClick(suggestion)}
                  style={{
                    padding: '8px 16px',
                    background: '#f5f5f5',
                    border: '1px solid #e0e0e0',
                    borderRadius: '20px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'normal',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#e8f5e9';
                    e.currentTarget.style.borderColor = '#2e7d32';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f5f5f5';
                    e.currentTarget.style.borderColor = '#e0e0e0';
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((message, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: message.role === 'user' ? 'flex-end' : 'flex-start'
            }}
          >
            <div
              style={{
                maxWidth: message.role === 'user' ? '70%' : '80%',
                padding: message.role === 'user' ? '10px 14px' : '12px',
                background: message.role === 'user' ? '#e8f5e9' : 'white',
                border: message.role === 'user' ? 'none' : '1px solid #e0e0e0',
                borderRadius: message.role === 'user' ? '16px' : '12px',
                fontSize: '14px',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word'
              }}
            >
              {message.content}
            </div>
            
            {/* Sources */}
            {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
              <div style={{ 
                fontSize: '11px', 
                color: '#888', 
                marginTop: '4px',
                marginLeft: '12px'
              }}>
                Sources: {message.sources.join(' · ')}
              </div>
            )}
          </div>
        ))}

        {/* Loading Indicator */}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                padding: '12px',
                background: 'white',
                border: '1px solid #e0e0e0',
                borderRadius: '12px',
                display: 'inline-flex',
                gap: '4px'
              }}
            >
              <span className="loading-dot" style={{ animationDelay: '0s' }}>●</span>
              <span className="loading-dot" style={{ animationDelay: '0.2s' }}>●</span>
              <span className="loading-dot" style={{ animationDelay: '0.4s' }}>●</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div 
        className="card"
        style={{ 
          padding: '12px',
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-end'
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about biodiversity..."
          rows={2}
          style={{
            flex: 1,
            padding: '10px 14px',
            fontSize: '14px',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            outline: 'none',
            resize: 'none',
            fontFamily: 'inherit',
            lineHeight: '1.5'
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !input.trim()}
          style={{
            padding: '10px 24px',
            fontSize: '14px',
            fontWeight: '600',
            color: 'white',
            background: loading || !input.trim() ? '#bdbdbd' : '#2e7d32',
            border: 'none',
            borderRadius: '8px',
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            height: '42px'
          }}
        >
          Send
        </button>
      </div>

      {/* Loading Animation CSS */}
      <style>{`
        @keyframes loading-bounce {
          0%, 80%, 100% {
            opacity: 0.4;
            transform: scale(1);
          }
          40% {
            opacity: 1;
            transform: scale(1.2);
          }
        }
        .loading-dot {
          display: inline-block;
          animation: loading-bounce 1.4s infinite ease-in-out;
          color: #757575;
          font-size: 8px;
        }
      `}</style>
    </div>
  );
};

export default Chat;
