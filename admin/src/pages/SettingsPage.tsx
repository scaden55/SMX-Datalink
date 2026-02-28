import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { FloppyDisk, SpinnerGap } from '@phosphor-icons/react';

// ── Types ───────────────────────────────────────────────────────

interface VaSetting {
  key: string;
  value: string;
  updatedBy: number | null;
  updatedAt: string;
}

interface VaSettingsResponse {
  settings: VaSetting[];
}

// ── Section definitions ─────────────────────────────────────────

interface FieldDef {
  key: string;
  label: string;
  description?: string;
  type: 'text' | 'number' | 'boolean';
  placeholder?: string;
}

interface SectionDef {
  id: string;
  title: string;
  description: string;
  fields: FieldDef[];
}

const SECTIONS: SectionDef[] = [
  {
    id: 'airline',
    title: 'Airline Info',
    description: 'Basic airline identity and branding settings.',
    fields: [
      { key: 'va.name', label: 'Airline Name', type: 'text', placeholder: 'SMX Virtual' },
      { key: 'va.icao', label: 'ICAO Code', type: 'text', placeholder: 'SMX' },
    ],
  },
  {
    id: 'finance',
    title: 'Finance Settings',
    description: 'Pilot compensation and cargo/passenger rates.',
    fields: [
      { key: 'finance.pay_per_hour', label: 'Pay Rate per Hour ($)', type: 'number', placeholder: '50', description: 'Amount paid per flight hour' },
      { key: 'finance.cargo_rate', label: 'Cargo Rate ($/lb)', type: 'number', placeholder: '0.0005', description: 'Pay rate per pound of cargo' },
      { key: 'finance.pax_rate', label: 'Passenger Rate ($/pax)', type: 'number', placeholder: '0.12', description: 'Pay rate per passenger' },
    ],
  },
  {
    id: 'booking',
    title: 'Booking Settings',
    description: 'Controls for pilot flight booking and bidding.',
    fields: [
      { key: 'bids.max_active', label: 'Max Active Bids', type: 'number', placeholder: '5', description: 'Maximum simultaneous flight bids per pilot' },
    ],
  },
  {
    id: 'pirep',
    title: 'PIREP Settings',
    description: 'Pilot report submission and approval rules.',
    fields: [
      { key: 'pirep.auto_approve', label: 'Auto-approve PIREPs', type: 'boolean', description: 'Automatically approve submitted PIREPs without manual review' },
      { key: 'pirep.min_score', label: 'Minimum Landing Score', type: 'number', placeholder: '0', description: 'Minimum landing score required for auto-approval (0 = no minimum)' },
    ],
  },
  {
    id: 'system',
    title: 'System Settings',
    description: 'Developer and system-level configuration.',
    fields: [
      { key: 'dev.enabled', label: 'Developer Mode', type: 'boolean', description: 'Enable developer tools and debug features' },
    ],
  },
];

// ── Skeleton ────────────────────────────────────────────────────

function SettingsPageSkeleton() {
  return (
    <div className="space-y-6 max-w-3xl">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-[200px] rounded-md" />
      ))}
    </div>
  );
}

// ── Section Card ────────────────────────────────────────────────

interface SectionCardProps {
  section: SectionDef;
  values: Record<string, string>;
  onSave: (keys: string[], values: Record<string, string>) => Promise<void>;
}

function SectionCard({ section, values, onSave }: SectionCardProps) {
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Sync local state when upstream values change (e.g. initial load)
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const field of section.fields) {
      next[field.key] = values[field.key] ?? '';
    }
    setLocalValues(next);
  }, [values, section.fields]);

  function handleChange(key: string, value: string) {
    setLocalValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleBooleanToggle(key: string, checked: boolean) {
    setLocalValues((prev) => ({ ...prev, [key]: checked ? 'true' : 'false' }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(
        section.fields.map((f) => f.key),
        localValues,
      );
      toast.success(`${section.title} saved`);
    } catch {
      // Error toast handled by caller
    } finally {
      setSaving(false);
    }
  }

  // Check if anything has changed
  const hasChanges = section.fields.some(
    (f) => (localValues[f.key] ?? '') !== (values[f.key] ?? ''),
  );

  return (
    <Card className="rounded-md">
      <CardHeader>
        <CardTitle className="text-lg">{section.title}</CardTitle>
        <CardDescription>{section.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {section.fields.map((field) => {
          if (field.type === 'boolean') {
            const checked = localValues[field.key] === 'true';
            return (
              <div key={field.key} className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  {field.description && (
                    <p className="text-sm text-muted-foreground">{field.description}</p>
                  )}
                </div>
                <Switch
                  id={field.key}
                  checked={checked}
                  onCheckedChange={(val) => handleBooleanToggle(field.key, val)}
                />
              </div>
            );
          }

          return (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={field.key}>{field.label}</Label>
              {field.description && (
                <p className="text-sm text-muted-foreground">{field.description}</p>
              )}
              <Input
                id={field.key}
                type={field.type === 'number' ? 'text' : 'text'}
                inputMode={field.type === 'number' ? 'decimal' : undefined}
                placeholder={field.placeholder}
                value={localValues[field.key] ?? ''}
                onChange={(e) => handleChange(field.key, e.target.value)}
                className="max-w-sm"
              />
            </div>
          );
        })}

        <div className="flex items-center gap-3 pt-2">
          <Button onClick={handleSave} disabled={saving || !hasChanges} size="sm">
            {saving ? (
              <>
                <SpinnerGap size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <FloppyDisk size={16} weight="duotone" />
                Save
              </>
            )}
          </Button>
          {!hasChanges && (
            <span className="text-sm text-muted-foreground">No changes</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ────────────────────────────────────────────────────────

export function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await api.get<VaSettingsResponse>('/api/admin/settings');
      const map: Record<string, string> = {};
      for (const s of res.settings) {
        map[s.key] = s.value;
      }
      setSettings(map);
      setError(null);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load settings';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = useCallback(
    async (keys: string[], localValues: Record<string, string>) => {
      const payload = keys.map((key) => ({
        key,
        value: localValues[key] ?? '',
      }));

      try {
        await api.put('/api/admin/settings', { settings: payload });
        // Update local state to reflect saved values
        setSettings((prev) => {
          const next = { ...prev };
          for (const item of payload) {
            next[item.key] = item.value;
          }
          return next;
        });
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Failed to save settings';
        toast.error(message);
        throw err; // Re-throw so the section card knows it failed
      }
    },
    [],
  );

  // ── Render ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-6">Settings</h1>
        <SettingsPageSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-6">Settings</h1>
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>
      <div className="space-y-6 max-w-3xl">
        {SECTIONS.map((section) => (
          <SectionCard
            key={section.id}
            section={section}
            values={settings}
            onSave={handleSave}
          />
        ))}
      </div>
    </div>
  );
}
