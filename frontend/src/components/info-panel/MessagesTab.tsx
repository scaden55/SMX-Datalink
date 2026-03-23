import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../lib/api';
import { toast } from '../../stores/toastStore';
import { useSocketStore } from '../../stores/socketStore';
import { useAuthStore } from '../../stores/authStore';
import { useDispatchEdit } from '../../contexts/DispatchEditContext';
import { Badge } from '../common/Badge';

interface Message {
  id: string;
  bidId: number;
  senderId: number;
  senderName: string;
  type: string;
  content: string;
  source: string;
  timestamp: string;
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}Z`;
}

function typeBadge(type: string) {
  switch (type) {
    case 'DISPATCHER':
      return <Badge variant="blue">DSP</Badge>;
    case 'PILOT':
      return <Badge variant="green">PLT</Badge>;
    case 'SYSTEM':
      return <Badge variant="amber">SYS</Badge>;
    default:
      return <Badge variant="amber">{type}</Badge>;
  }
}

export function MessagesTab() {
  const { bidId, phase } = useDispatchEdit();
  const socket = useSocketStore((s) => s.socket);
  const user = useAuthStore((s) => s.user);
  const isCompleted = phase === 'completed';

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Fetch messages on mount / bid change
  useEffect(() => {
    if (!bidId) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<{ messages: Message[] }>(`/api/dispatch/flights/${bidId}/messages`);
        if (!cancelled) setMessages(data.messages);
      } catch (err) {
        console.error('[Messages] Fetch failed:', err);
        toast.error('Failed to load messages');
      }
    })();
    return () => { cancelled = true; };
  }, [bidId]);

  // Listen for new messages (subscription is handled by DispatchPage)
  useEffect(() => {
    if (!socket || !bidId) return;

    const handler = (msg: Message) => {
      setMessages((prev) => {
        // Deduplicate — the sender may already have the message from the POST response
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    };
    socket.on('acars:message', handler);

    return () => {
      socket.off('acars:message', handler);
    };
  }, [socket, bidId]);

  // Auto-scroll to newest
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
    } catch (err) {
      console.error('[Messages] Send failed:', err);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  }, [bidId, input, sending]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  if (!bidId) {
    return (
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-acars-text">ACARS Messages</h3>
        <div className="panel p-3">
          <div className="text-[12px] text-acars-muted italic">
            Select a flight to view messages.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-xs font-semibold text-acars-text mb-2">ACARS Messages</h3>

      {/* Message list */}
      <div ref={listRef} className="flex-1 overflow-y-auto space-y-1.5 mb-2 min-h-0">
        {messages.length === 0 ? (
          <div className="text-[12px] text-acars-muted italic p-2">
            No messages yet. Send a message to begin communication.
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className="flex items-start gap-2 px-2 py-1.5 rounded bg-acars-input/50 text-[12px]"
            >
              <span className="text-acars-muted shrink-0 tabular-nums text-[11px] mt-0.5">
                {formatTimestamp(msg.timestamp)}
              </span>
              <span className="shrink-0 mt-0.5">{typeBadge(msg.type)}</span>
              <div className="min-w-0">
                <span className="font-medium text-acars-text">{msg.senderName}: </span>
                <span className="text-acars-text">{msg.content}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input area */}
      {!isCompleted && (
        <div className="flex gap-2 pt-2 border-t border-acars-border">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Send as ${user?.role === 'admin' ? 'Dispatcher' : 'Pilot'}...`}
            className="flex-1 rounded bg-acars-bg border border-acars-border text-acars-text text-[12px] px-2 py-1.5 focus:outline-none focus:border-sky-400"
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
      )}
    </div>
  );
}
