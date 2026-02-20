interface StatusConfig {
  bg: string;
  text: string;
  dot?: string;
  label?: string;
}

interface StatusBadgeProps {
  status: string;
  config: Record<string, StatusConfig>;
}

export function StatusBadge({ status, config }: StatusBadgeProps) {
  const cfg = config[status] ?? {
    bg: 'bg-gray-500/10',
    text: 'text-gray-400',
    dot: 'bg-gray-400',
  };

  const label = cfg.label ?? status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide ${cfg.bg} ${cfg.text}`}>
      {cfg.dot && <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />}
      {label}
    </span>
  );
}
