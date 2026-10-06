import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import ImageFrame from './ImageFrame';
import './Assistant.css';

type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
  size: string;
  condition: string;
  image?: string;
  isDemo?: boolean;
};

type ChatMessage = {
  id: number;
  role: 'assistant' | 'user';
  text: string;
  action?: { label: string; url: string };
  products?: Product[];
  demo?: boolean;
};

const welcome: ChatMessage = {
  id: 0,
  role: 'assistant',
  text: 'Hi! Welcome to EcoSwap. I can help you browse real listings, understand product details, or learn how to sell, donate, exchange, or recycle clothing.',
  action: { label: 'Browse Products', url: '/marketplace' }
};

export default function Assistant() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([welcome]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const nextId = useRef(1);
  const messageList = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messageList.current?.scrollTo({ top: messageList.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading, open]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const message = input.trim();
    if (!message || loading) return;

    setInput('');
    setError('');
    setMessages((current) => [...current, { id: nextId.current++, role: 'user', text: message }]);
    setLoading(true);
    try {
      const history = messages
        .filter((item) => item.id !== 0)
        .slice(-10)
        .map((item) => ({ role: 'user', content: item.text }));
      const result = await api.chat(message, history);
      setMessages((current) => [...current, {
        id: nextId.current++,
        role: 'assistant',
        text: result.message,
        action: result.action,
        products: result.products,
        demo: result.demo
      }]);
    } catch (sendError) {
      const messageText = sendError instanceof Error ? sendError.message : 'Unable to contact the assistant.';
      setError(messageText);
    } finally {
      setLoading(false);
    }
  }

  function clearConversation() {
    setMessages([welcome]);
    setError('');
    setInput('');
  }

  return (
    <aside className="assistant-root" aria-label="EcoSwap shopping assistant">
      {open && (
        <section className="assistant-panel" aria-label="Chat panel">
          <div className="assistant-header">
            <div><strong>EcoSwap AI Assistant</strong><small>Shopping and sustainability help</small></div>
            <div className="assistant-controls">
              <button type="button" onClick={clearConversation} aria-label="Clear conversation">Clear</button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant">×</button>
            </div>
          </div>
          <div className="assistant-messages" ref={messageList} aria-live="polite">
            {messages.map((message) => (
              <div className={`assistant-message ${message.role}`} key={message.id}>
                <p>{message.text}</p>
                {message.action && (
                  <button type="button" className="assistant-action" onClick={() => { navigate(message.action!.url); setOpen(false); }}>
                    {message.action.label}
                  </button>
                )}
                {message.products?.map((product) => (
                  <Link className="assistant-product" to={`/product/${product.id}`} key={product.id} onClick={() => setOpen(false)}>
                    <ImageFrame src={product.image} alt="" className="assistant-product-image" />
                    <span><strong>{product.name}</strong><small>{product.category} · Size {product.size} · {product.condition}</small></span>
                    <b>₹{Number(product.price).toLocaleString('en-IN')}</b>
                    {product.isDemo && <small className="demo-listing-badge">Demo</small>}
                  </Link>
                ))}
                {message.demo && <small className="assistant-demo-note">Demo assistant</small>}
              </div>
            ))}
            {loading && <p className="assistant-loading" role="status">Finding helpful information…</p>}
            {error && <p className="error" role="alert">{error}</p>}
          </div>
          <form className="assistant-form" onSubmit={send}>
            <input aria-label="Message EcoSwap AI Assistant" placeholder="Ask me anything about EcoSwap…" value={input} onChange={(event) => setInput(event.target.value)} maxLength={1000} />
            <button type="submit" disabled={!input.trim() || loading}>Send</button>
          </form>
        </section>
      )}
      <button className="assistant-toggle" type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        {open ? 'Close assistant' : 'Ask EcoSwap'}
      </button>
    </aside>
  );
}
