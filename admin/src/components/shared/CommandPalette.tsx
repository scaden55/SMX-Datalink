import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import {
  ChartLineUp,
  MapTrifold,
  CalendarBlank,
  ClipboardText,
  Users,
  Wrench,
  CurrencyDollar,
  ChartBar,
  Bell,
  ClockCounterClockwise,
  Gear,
} from '@phosphor-icons/react';

const pages = [
  { label: 'Dashboard', path: '/', icon: ChartLineUp, shortcut: 'D' },
  { label: 'Dispatch Board', path: '/dispatch', icon: MapTrifold, shortcut: 'B' },
  { label: 'Schedules', path: '/schedules', icon: CalendarBlank, shortcut: 'S' },
  { label: 'PIREPs', path: '/pireps', icon: ClipboardText, shortcut: 'P' },
  { label: 'Users', path: '/users', icon: Users, shortcut: 'U' },
  { label: 'Maintenance', path: '/maintenance', icon: Wrench, shortcut: 'M' },
  { label: 'Finances', path: '/finances', icon: CurrencyDollar, shortcut: 'F' },
  { label: 'Reports', path: '/reports', icon: ChartBar, shortcut: 'R' },
  { label: 'Notifications', path: '/notifications', icon: Bell, shortcut: 'N' },
  { label: 'Audit Log', path: '/audit', icon: ClockCounterClockwise, shortcut: 'A' },
  { label: 'Settings', path: '/settings', icon: Gear, shortcut: ',' },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
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

  const handleSelect = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command Palette"
      loop
      overlayClassName="fixed inset-0 bg-black/50 z-50"
      contentClassName="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
    >
      <div className="max-w-lg w-full bg-[#1c2033] border border-border/50 rounded-md shadow-2xl overflow-hidden">
        <Command.Input
          placeholder="Search pages..."
          autoFocus
          className="bg-transparent border-b border-border/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
        />
        <Command.List className="max-h-[300px] overflow-y-auto py-1">
          <Command.Empty className="px-4 py-6 text-sm text-center text-muted-foreground">
            No results found.
          </Command.Empty>

          <Command.Group
            heading="Pages"
            className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-1.5"
          >
            {pages.map((page) => (
              <Command.Item
                key={page.path}
                value={page.label}
                onSelect={() => handleSelect(page.path)}
                className="px-4 py-2.5 text-sm flex items-center gap-3 cursor-pointer rounded-sm mx-1 text-muted-foreground data-[selected=true]:bg-blue-500/10 data-[selected=true]:text-foreground"
              >
                <page.icon size={18} weight="regular" />
                <span>{page.label}</span>
                <kbd className="ml-auto text-[10px] text-muted-foreground/50">{page.shortcut}</kbd>
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>
      </div>
    </Command.Dialog>
  );
}
