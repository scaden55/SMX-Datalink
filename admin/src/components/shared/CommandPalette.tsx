import { useEffect, useRef, useState } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Map,
  Calendar,
  ClipboardList,
  Users,
  Wrench,
  DollarSign,
  BarChart3,
  Bell,
  History,
  Settings,
  User,
  Plane,
  Cog,
  Zap,
} from 'lucide-react';
import { api } from '@/lib/api';

interface SearchUser {
  id: number;
  callsign: string;
  name: string;
  role: string;
}

interface SearchFlight {
  id: number;
  flightNumber: string;
  route: string;
  status: string;
}

interface SearchAircraft {
  id: number;
  registration: string;
  type: string;
  status: string;
}

interface SearchSchedule {
  id: number;
  flightNumber: string;
  route: string;
}

interface SearchResults {
  users: SearchUser[];
  flights: SearchFlight[];
  aircraft: SearchAircraft[];
  schedules: SearchSchedule[];
}

const pages = [
  { label: 'Dashboard', path: '/', icon: TrendingUp, shortcut: 'D' },
  { label: 'Dispatch Board', path: '/dispatch', icon: Map, shortcut: 'B' },
  { label: 'Schedules', path: '/schedules', icon: Calendar, shortcut: 'S' },
  { label: 'PIREPs', path: '/pireps', icon: ClipboardList, shortcut: 'P' },
  { label: 'Users', path: '/users', icon: Users, shortcut: 'U' },
  { label: 'Maintenance', path: '/maintenance', icon: Wrench, shortcut: 'M' },
  { label: 'Finances', path: '/finances', icon: DollarSign, shortcut: 'F' },
  { label: 'Reports', path: '/reports', icon: BarChart3, shortcut: 'R' },
  { label: 'Notifications', path: '/notifications', icon: Bell, shortcut: 'N' },
  { label: 'Audit Log', path: '/audit', icon: History, shortcut: 'A' },
  { label: 'Settings', path: '/settings', icon: Settings, shortcut: ',' },
];

const groupHeadingClass =
  '[&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-1.5';

const itemClass =
  'px-4 py-2.5 text-sm flex items-center gap-3 cursor-pointer rounded-sm mx-1 text-muted-foreground data-[selected=true]:bg-[var(--accent-blue-bg)] data-[selected=true]:text-foreground';

function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (s === 'approved' || s === 'accepted' || s === 'active' || s === 'completed') return 'text-[var(--accent-emerald)]';
  if (s === 'pending' || s === 'filed') return 'text-[var(--accent-amber)]';
  if (s === 'rejected' || s === 'failed' || s === 'inactive') return 'text-[var(--accent-red)]';
  return 'text-muted-foreground';
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults(null);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get<SearchResults>(`/api/admin/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(res);
      } catch {
        // Silently fail - don't show errors for search
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [searchQuery]);

  const handleSelect = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  // Clear search state when palette closes
  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSearchQuery('');
      setSearchResults(null);
      clearTimeout(debounceRef.current);
    }
  };

  const hasUsers = searchResults && searchResults.users.length > 0;
  const hasFlights = searchResults && searchResults.flights.length > 0;
  const hasAircraft = searchResults && searchResults.aircraft.length > 0;
  const hasSchedules = searchResults && searchResults.schedules.length > 0;

  return (
    <Command.Dialog
      open={open}
      onOpenChange={handleOpenChange}
      label="Command Palette"
      loop
      overlayClassName="fixed inset-0 bg-black/50 z-50"
      contentClassName="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
    >
      <div className="max-w-lg w-full bg-[var(--surface-3)] border border-[var(--border-primary)] rounded-md shadow-2xl overflow-hidden">
        <Command.Input
          placeholder="Search pages, pilots, flights..."
          autoFocus
          onValueChange={setSearchQuery}
          className="bg-transparent border-b border-border/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
        />
        <Command.List className="max-h-[300px] overflow-y-auto py-1">
          <Command.Empty className="px-4 py-6 text-sm text-center text-muted-foreground">
            No results found.
          </Command.Empty>

          {/* Pages — always shown, filtered by cmdk automatically */}
          <Command.Group heading="Pages" className={groupHeadingClass}>
            {pages.map((page) => (
              <Command.Item
                key={page.path}
                value={page.label}
                onSelect={() => handleSelect(page.path)}
                className={itemClass}
              >
                <page.icon size={18} />
                <span>{page.label}</span>
                <kbd className="ml-auto text-[11px] text-muted-foreground/50">{page.shortcut}</kbd>
              </Command.Item>
            ))}
          </Command.Group>

          {/* Pilots — from search results */}
          {hasUsers && (
            <Command.Group heading="Pilots" className={groupHeadingClass}>
              {searchResults.users.map((user) => (
                <Command.Item
                  key={`user-${user.id}`}
                  value={`pilot ${user.callsign} ${user.name}`}
                  onSelect={() => handleSelect('/users')}
                  className={itemClass}
                >
                  <User size={18} />
                  <span className="font-mono text-xs text-[var(--accent-blue-bright)]">{user.callsign}</span>
                  <span>{user.name}</span>
                  <span className="ml-auto text-[11px] text-muted-foreground/50">{user.role}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Flights — from search results */}
          {hasFlights && (
            <Command.Group heading="Flights" className={groupHeadingClass}>
              {searchResults.flights.map((flight) => (
                <Command.Item
                  key={`flight-${flight.id}`}
                  value={`flight ${flight.flightNumber} ${flight.route}`}
                  onSelect={() => handleSelect('/pireps')}
                  className={itemClass}
                >
                  <Plane size={18} />
                  <span className="font-mono text-xs">{flight.flightNumber}</span>
                  <span className="text-muted-foreground">{flight.route}</span>
                  <span className={`ml-auto text-[11px] ${statusColor(flight.status)}`}>
                    {flight.status}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Aircraft — from search results */}
          {hasAircraft && (
            <Command.Group heading="Aircraft" className={groupHeadingClass}>
              {searchResults.aircraft.map((ac) => (
                <Command.Item
                  key={`aircraft-${ac.id}`}
                  value={`aircraft ${ac.registration} ${ac.type}`}
                  onSelect={() => handleSelect('/maintenance')}
                  className={itemClass}
                >
                  <Cog size={18} />
                  <span className="font-mono text-xs text-[var(--accent-blue-bright)]">{ac.registration}</span>
                  <span className="text-muted-foreground">{ac.type}</span>
                  <span className={`ml-auto text-[11px] ${statusColor(ac.status)}`}>
                    {ac.status}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Schedules — from search results */}
          {hasSchedules && (
            <Command.Group heading="Schedules" className={groupHeadingClass}>
              {searchResults.schedules.map((sched) => (
                <Command.Item
                  key={`schedule-${sched.id}`}
                  value={`schedule ${sched.flightNumber} ${sched.route}`}
                  onSelect={() => handleSelect('/schedules')}
                  className={itemClass}
                >
                  <Calendar size={18} />
                  <span className="font-mono text-xs">{sched.flightNumber}</span>
                  <span className="text-muted-foreground">{sched.route}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Quick Actions */}
          <Command.Group heading="Quick Actions" className={groupHeadingClass}>
            <Command.Item
              value="Approve pending PIREPs"
              onSelect={() => handleSelect('/pireps?status=pending')}
              className={itemClass}
            >
              <Zap size={18} />
              <span>Approve pending PIREPs</span>
            </Command.Item>
            <Command.Item
              value="Generate payroll"
              onSelect={() => handleSelect('/finances?tab=pilot-pay')}
              className={itemClass}
            >
              <Zap size={18} />
              <span>Generate payroll</span>
            </Command.Item>
          </Command.Group>
        </Command.List>
      </div>
    </Command.Dialog>
  );
}
