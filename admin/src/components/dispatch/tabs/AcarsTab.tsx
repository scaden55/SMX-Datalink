import { useState, useEffect, useRef, useCallback } from 'react';
import type { AcarsMessagePayload } from '@acars/shared';
import { useSocketStore } from '@/stores/socketStore';
import { api } from '@/lib/api';

interface AcarsTabProps {
  bidId: number;
  messages: AcarsMessagePayload[];
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}Z`;
}

function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    DISPATCHER: 'bg-sky-500/15 text-sky-400 border-sky-400/20',
    DISPATCH: 'bg-sky-500/15 text-sky-400 border-sky-400/20',
    PILOT: 'bg-emerald-500/15 text-emerald-400 border-emerald-400/20',
    SYSTEM: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  };
  const labels: Record<string, string> = {
    DISPATCHER: 'DSP',
    DISPATCH: 'DSP',
    PILOT: 'PLT',
    SYSTEM: 'SYS',
  };

  const key = type.toUpperCase();
  const style = styles[key] ?? 'bg-amber-500/15 text-amber-400 border-amber-500/20';
  const label = labels[key] ?? type.substring(0, 3).toUpperCase();

  return (
    <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold border ${style}`}>
      {label}
    </span>
  );
}

export default function AcarsTab({ bidId, messages: initialMessages }: AcarsTabProps) {
  const [messages, setMessages] = useState<AcarsMessagePayload[]>(initialMessages);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const socket = useSocketStore((s) => s.socket);

  // Sync initial messages
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  // Listen for new messages
  useEffect(() => {
    if (!socket) return;

    const handler = (msg: AcarsMessagePayload) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    };
    socket.on('acars:message', handler);
    return () => {
      socket.off('acars:message', handler);
    };
  }, [socket]);

  // Auto-scroll
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!bidId || !input.trim() || sending) return;

    setSending(true);
    try {
      await api.post(`/api/dispatch/flights/${bidId}/messages`, { content: input.trim() });
      setInput('');
    } catch {
      // Toast handled elsewhere
    } finally {
      setSending(false);
    }
  }, [bidId, input, sending]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
        ACARS Messages
      </h3>

      {/* Message list */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto space-y-1.5 mb-2 min-h-0 max-h-[300px]"
      >
        {messages.length === 0 ? (
          <div className="text-[12px] text-[var(--text-muted)] italic p-2">
            No messages yet. Send a message to begin communication.
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className="flex items-start gap-2 px-2 py-1.5 rounded bg-[var(--surface-1)] text-[12px]"
            >
              <span className="text-[var(--text-muted)] shrink-0 tabular-nums text-[11px] font-mono mt-0.5">
                {formatTimestamp(msg.timestamp)}
              </span>
              <span className="shrink-0 mt-0.5">
                <TypeBadge type={msg.source} />
              </span>
              <div className="min-w-0">
                <span className="font-medium text-[var(--text-primary)]">{msg.senderName}: </span>
                <span className="text-[var(--text-secondary)]">{msg.content}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input area */}
      <div className="flex gap-2 pt-2 border-t border-[var(--surface-3)]">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send as Dispatcher..."
          className="flex-1 rounded bg-[var(--surface-2)] border border-[var(--surface-3)] text-[var(--text-primary)] text-[12px] px-2 py-1.5 focus:outline-none focus:border-[var(--accent)]"
          disabled={sending}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="px-3 py-1.5 rounded text-[12px] font-medium bg-sky-500/10 text-sky-400 border border-sky-400/20 hover:bg-sky-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>
    </div>
  );
}
