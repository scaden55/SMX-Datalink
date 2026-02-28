import { useState, useEffect, useRef } from 'react';
import { PaperPlaneRight } from '@phosphor-icons/react';
import type { AcarsMessagePayload } from '@acars/shared';
import { useSocketStore } from '@/stores/socketStore';

interface AcarsChatProps {
  bidId: number | null;
  messages: AcarsMessagePayload[];
}

function getMessageStyle(source: string) {
  switch (source.toUpperCase()) {
    case 'PILOT':
      return 'bg-zinc-700/50 text-zinc-200';
    case 'DISPATCH':
    case 'DISPATCHER':
      return 'bg-primary/20 text-blue-200';
    case 'SYSTEM':
      return 'bg-amber-900/30 text-amber-200 italic';
    default:
      return 'bg-zinc-700/50 text-zinc-200';
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
      <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
        Select a flight to chat
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="border-t border-border px-4 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">ACARS Messages</h3>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-2 max-h-[200px] min-h-[120px]">
        {messages.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-4">No messages yet</p>
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
      <div className="flex items-center gap-2 border-t border-border px-4 py-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="flex-1 rounded bg-secondary px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="rounded bg-primary p-1.5 text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-40"
        >
          <PaperPlaneRight size={14} weight="bold" />
        </button>
      </div>
    </div>
  );
}
