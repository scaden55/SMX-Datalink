import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { useNotificationStore } from '../../stores/notificationStore';

export function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { notifications, unreadCount, fetch, markRead, markAllRead } = useNotificationStore();

  // Poll for notifications every 30s, pausing when tab is hidden
  useEffect(() => {
    fetch();
    let intervalId = setInterval(fetch, 30_000);

    const handleVisibility = () => {
      if (document.hidden) {
        clearInterval(intervalId);
      } else {
        fetch();
        intervalId = setInterval(fetch, 30_000);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetch]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative text-acars-muted hover:text-acars-text transition-colors p-1"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <>
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[14px] h-3.5 rounded-full bg-red-500 text-[8px] font-bold text-white px-0.5">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
            <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-red-500/40 animate-ping" />
          </>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-[9999] w-80 max-h-96 flex flex-col rounded-md border border-acars-border bg-acars-hover shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-acars-border">
            <span className="text-xs font-semibold text-acars-text">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead()}
                className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-400/80 transition-colors"
              >
                <CheckCheck className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-xs text-acars-muted">
                No notifications
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    if (!n.read) markRead(n.id);
                    if (n.link) { navigate(n.link); setOpen(false); }
                  }}
                  className={`w-full text-left px-3 py-2.5 border-b border-acars-border hover:bg-acars-hover transition-colors ${
                    !n.read ? 'bg-blue-500/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && (
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                    )}
                    <div className={`flex-1 min-w-0 ${n.read ? 'pl-3.5' : ''}`}>
                      <p className="text-xs text-acars-text leading-relaxed">{n.message}</p>
                      <p className="text-[10px] text-acars-muted mt-0.5">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
