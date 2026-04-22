import { useState, useRef, useEffect } from 'react';

const SYSTEM_PROMPT = `You are a friendly ordering assistant for a bubble tea shop. Help customers choose drinks, explain menu items, suggest customizations (milk tea, fruit tea, toppings, sweetness levels, ice levels), and guide them through placing their order. Keep responses concise and friendly. Only answer questions related to the menu and ordering process.`;

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi! I can help you pick a drink or customize your order. What sounds good?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userText = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userText }]);
    setLoading(true);

    // Build conversation history in Groq/OpenAI format
    const messages_payload = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.text,
      })),
      { role: 'user', content: userText },
    ];

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messages_payload }),
      });
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content ?? 'Sorry, I could not get a response.';
      setMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="chat-widget">
      {isOpen && (
        <div className="chat-panel panel">
          <div className="chat-panel-header">
            <strong>Order Assistant</strong>
            <button onClick={() => setIsOpen(false)} aria-label="Close chat">✕</button>
          </div>
          <div className="chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`chat-message chat-message--${m.role}`}>
                {m.text}
              </div>
            ))}
            {loading && <div className="chat-message chat-message--assistant">Typing…</div>}
            <div ref={bottomRef} />
          </div>
          <div className="chat-input-row">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about the menu…"
              aria-label="Chat input"
            />
            <button onClick={sendMessage} disabled={loading} className="primary">
              Send
            </button>
          </div>
        </div>
      )}
      <button
        className="chat-trigger accessibility-trigger"
        onClick={() => setIsOpen((o) => !o)}
        aria-label="Toggle order assistant"
      >
        💬 Order Help
      </button>
    </div>
  );
}