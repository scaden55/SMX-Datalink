import { Card, CardContent } from '@/components/ui/card';
import { ArrowUp, ArrowDown } from '@phosphor-icons/react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
}

export function StatCard({ title, value, icon, trend }: StatCardProps) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{title}</p>
          <div className="text-muted-foreground">{icon}</div>
        </div>
        <p className="mt-2 text-3xl font-bold font-mono tracking-tight">
          {value}
        </p>
        {trend && (
          <div className="mt-2 flex items-center gap-1 text-xs">
            {trend.value >= 0 ? (
              <ArrowUp weight="bold" className="h-3 w-3 text-emerald-500" />
            ) : (
              <ArrowDown weight="bold" className="h-3 w-3 text-red-500" />
            )}
            <span
              className={
                trend.value >= 0 ? 'text-emerald-500' : 'text-red-500'
              }
            >
              {Math.abs(trend.value)}%
            </span>
            <span className="text-muted-foreground">{trend.label}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
