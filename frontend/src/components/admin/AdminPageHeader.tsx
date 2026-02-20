import type { LucideIcon } from 'lucide-react';

interface StatCard {
  label: string;
  value: string | number;
  color?: string;
}

interface AdminPageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  stats?: StatCard[];
  actions?: React.ReactNode;
}

export function AdminPageHeader({ icon: Icon, title, subtitle, stats, actions }: AdminPageHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-acars-blue/10">
            <Icon className="w-5 h-5 text-acars-blue" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-acars-text">{title}</h1>
            {subtitle && <p className="text-xs text-acars-muted">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {stats && stats.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className="panel px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-acars-muted mb-1">{stat.label}</p>
              <p className={`text-xl font-semibold ${stat.color ?? 'text-acars-text'}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
