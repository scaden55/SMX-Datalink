import { useState, useEffect, useRef } from 'react';
import { SendHorizontal } from 'lucide-react';
import type { AcarsMessagePayload } from '@acars/shared';
import { useSocketStore } from '@/stores/socketStore';

interface AcarsChatProps {
  bidId: number | null;
  messages: AcarsMessagePayload[];
}

function getMessageStyle(source: string) {
  switch (source.toUpperCase()) {
    case 'PILOT':
      return 'bg-[var(--surface-3)] text-[var(--text-secondary)]';
    case 'DISPATCH':
    case 'DISPATCHER':
      return 'bg-[var(--accent-blue-bg)] text-[var(--accent-blue)]';
    case 'SYSTEM':
      return 'bg-[var(--accent-amber-bg)] text-[var(--accent-amber)] italic';
    default:
      return 'bg-[var(--surface-3)] text-[var(--text-secondary)]';
  }
}

function getSourceLabel(source: string) {
  switch (source.toUpperCase()) {
    case 'PILOT':
      return 'PILOT';
    case 'DISPATCH':
    case 'DISPATCHER':
      return 'DISPATCH';
    case 'SYSTEM':
      return 'SYSTEM';
    default:
      return source.toUpperCase();
  }
}

export function AcarsChat({ bidId, messages }: AcarsChatProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const socket = useSocketStore((s) => s.socket);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || !bidId || !socket) return;
    socket.emit('acars:sendMessage', { bidId, content: input.trim() });
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!bidId) {
    return (
      <div className="flex items-center justify-center py-8 text-xs text-[var(--text-quaternary)]">
        Select a flight to chat
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="border-t border-[var(--border-primary)] px-4 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">ACARS Messages</h3>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-2 max-h-[200px] min-h-[120px]">
        {messages.length === 0 ? (
          <p className="text-center text-xs text-[var(--text-quaternary)] py-4">No messages yet</p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`rounded px-3 py-2 text-xs ${getMessageStyle(msg.source)}`}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="font-semibold text-[10px] uppercase tracking-wide opacity-70">
                  {getSourceLabel(msg.source)} - {msg.senderName}
                </span>
                <span className="font-mono text-[10px] opacity-50">
                  {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p>{msg.content}</p>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 border-t border-[var(--border-primary)] px-4 py-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="flex-1 rounded bg-[var(--surface-3)] px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="rounded bg-[var(--accent-blue)] p-1.5 text-white transition-colors hover:brightness-110 disabled:opacity-40"
        >
          <SendHorizontal size={14} />
        </button>
      </div>
    </div>
  );
}
