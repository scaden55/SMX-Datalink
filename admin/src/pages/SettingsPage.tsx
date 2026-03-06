import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Settings,
  Building2,
  DollarSign,
  ClipboardList,
  CalendarDays,
  Server,
  Plane,
  ChevronRight,
  Save,
  Loader2,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import {
  pageVariants,
  staggerContainer,
  staggerItem,
  fadeUp,
  cardHover,
} from '@/lib/motion';

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
  type: 'text' | 'number' | 'boolean' | 'select';
  placeholder?: string;
  options?: { value: string; label: string }[];
  half?: boolean; // for 2-column grid placement
}

interface SectionDef {
  id: string;
  title: string;
  summary: string;
  icon: typeof Building2;
  fields: FieldDef[];
}

const SECTIONS: SectionDef[] = [
  {
    id: 'airline',
    title: 'Airline Information',
    summary: 'Name, ICAO code, base airport',
    icon: Building2,
    fields: [
      { key: 'va.name', label: 'Airline Name', type: 'text', placeholder: 'SMA Virtual', half: true },
      { key: 'va.icao', label: 'ICAO Code', type: 'text', placeholder: 'SMX', half: true },
      { key: 'va.base_airport', label: 'Base Airport (ICAO)', type: 'text', placeholder: 'KMIA', half: true },
      { key: 'va.currency', label: 'Default Currency', type: 'text', placeholder: 'USD', half: true },
    ],
  },
  {
    id: 'finance',
    title: 'Finance & Billing',
    summary: 'Fuel costs, pilot pay rates',
    icon: DollarSign,
    fields: [
      { key: 'finance.fuel_cost', label: 'Fuel Cost ($/gal)', type: 'number', placeholder: '5.50', half: true },
      { key: 'finance.pay_per_hour', label: 'Pilot Pay Rate ($/hr)', type: 'number', placeholder: '50', half: true },
      { key: 'finance.cargo_rate', label: 'Cargo Rate ($/lb)', type: 'number', placeholder: '0.0005', half: true },
      { key: 'finance.pax_rate', label: 'Passenger Rate ($/pax)', type: 'number', placeholder: '0.12', half: true },
    ],
  },
  {
    id: 'pirep',
    title: 'PIREP Settings',
    summary: 'Auto-approval, landing rate limits',
    icon: ClipboardList,
    fields: [
      { key: 'pirep.auto_approve', label: 'Auto-approve PIREPs', type: 'boolean', description: 'Automatically approve submitted PIREPs without manual review' },
      { key: 'pirep.min_score', label: 'Minimum Landing Score', type: 'number', placeholder: '0', description: 'Minimum landing score required for auto-approval (0 = no minimum)' },
    ],
  },
  {
    id: 'booking',
    title: 'Booking & Scheduling',
    summary: 'Max bids, route limits, charter generation',
    icon: CalendarDays,
    fields: [
      { key: 'bids.max_active', label: 'Max Active Bids', type: 'number', placeholder: '5', description: 'Maximum simultaneous flight bids per pilot', half: true },
      { key: 'bids.route_limit', label: 'Route Limit', type: 'number', placeholder: '50', description: 'Maximum number of routes per schedule', half: true },
      { key: 'charter.auto_generate', label: 'Auto-generate Charters', type: 'boolean', description: 'Automatically create charter flights' },
    ],
  },
  {
    id: 'simbrief',
    title: 'SimBrief Integration',
    summary: 'Pilot ID, API key for airframe imports',
    icon: Plane,
    fields: [
      { key: 'simbrief.pilot_id', label: 'SimBrief Pilot ID', type: 'text', placeholder: '252500', description: 'Your numeric Pilot ID from SimBrief (Settings → Account). Required for importing custom airframes via share links.' },
    ],
  },
  {
    id: 'system',
    title: 'System & Integration',
    summary: 'VATSIM, Discord, log level',
    icon: Server,
    fields: [
      { key: 'vatsim.enabled', label: 'VATSIM Integration', type: 'boolean', description: 'Enable VATSIM network monitoring' },
      { key: 'discord.webhook_url', label: 'Discord Webhook URL', type: 'text', placeholder: 'https://discord.com/api/webhooks/...', description: 'Webhook URL for Discord notifications' },
      {
        key: 'system.log_level',
        label: 'Log Level',
        type: 'select',
        options: [
          { value: 'error', label: 'Error' },
          { value: 'warn', label: 'Warning' },
          { value: 'info', label: 'Info' },
          { value: 'debug', label: 'Debug' },
        ],
      },
      { key: 'dev.enabled', label: 'Developer Mode', type: 'boolean', description: 'Enable developer tools and debug features' },
    ],
  },
];

// ── Skeleton ────────────────────────────────────────────────────

function SettingsPageSkeleton() {
  return (
    <div className="flex flex-col" style={{ padding: '0 24px 24px 24px', gap: 8 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 56,
            borderRadius: 6,
            backgroundColor: 'var(--surface-2)',
          }}
          className="animate-pulse"
        />
      ))}
    </div>
  );
}

// ── Accordion Section ───────────────────────────────────────────

interface AccordionSectionProps {
  section: SectionDef;
  expanded: boolean;
  onToggle: () => void;
  values: Record<string, string>;
  localValues: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
}

function AccordionSection({ section, expanded, onToggle, values, localValues, onFieldChange }: AccordionSectionProps) {
  const Icon = section.icon;

  return (
    <div
      className="card-interactive"
      style={{
        borderRadius: 6,
        border: '1px solid var(--border-primary)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="flex items-center w-full"
        style={{
          padding: '16px 20px',
          backgroundColor: 'var(--surface-2)',
          border: 'none',
          cursor: 'pointer',
          gap: 12,
        }}
      >
        <Icon size={16} style={{ color: 'var(--accent-blue-bright)', flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{section.title}</span>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 4 }}>{section.summary}</span>
        <div className="flex-1" />
        <ChevronRight
          size={14}
          style={{
            color: 'var(--text-tertiary)',
            transition: 'transform 200ms',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            flexShrink: 0,
          }}
        />
      </button>

      {/* Expanded body */}
      {expanded && (
        <div
          style={{
            padding: '20px 20px',
            borderTop: '1px solid var(--border-primary)',
            backgroundColor: 'var(--surface-0)',
          }}
        >
          {/* Fields grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: section.fields.some((f) => f.half) ? '1fr 1fr' : '1fr',
              gap: 16,
            }}
          >
            {section.fields.map((field) => {
              if (field.type === 'boolean') {
                const checked = (localValues[field.key] ?? values[field.key] ?? '') === 'true';
                return (
                  <div
                    key={field.key}
                    className="flex items-center justify-between"
                    style={{
                      gridColumn: '1 / -1',
                      padding: '10px 0',
                    }}
                  >
                    <div className="flex flex-col" style={{ gap: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>{field.label}</span>
                      {field.description && (
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{field.description}</span>
                      )}
                    </div>
                    <button
                      onClick={() => onFieldChange(field.key, checked ? 'false' : 'true')}
                      className="flex items-center"
                      style={{
                        width: 36,
                        height: 20,
                        borderRadius: 10,
                        padding: 2,
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: checked ? 'var(--accent-blue)' : 'var(--surface-3)',
                        transition: 'background-color 200ms',
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          backgroundColor: '#fff',
                          transition: 'transform 200ms',
                          transform: checked ? 'translateX(16px)' : 'translateX(0)',
                        }}
                      />
                    </button>
                  </div>
                );
              }

              if (field.type === 'select') {
                return (
                  <div
                    key={field.key}
                    className="flex flex-col"
                    style={{ gap: 6, gridColumn: field.half ? undefined : '1 / -1' }}
                  >
                    <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>{field.label}</label>
                    {field.description && (
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: -4 }}>{field.description}</span>
                    )}
                    <select
                      value={localValues[field.key] ?? values[field.key] ?? ''}
                      onChange={(e) => onFieldChange(field.key, e.target.value)}
                      className="input-glow"
                      style={{
                        backgroundColor: 'var(--input-bg)',
                        border: '1px solid var(--input-border)',
                        borderRadius: 4,
                        padding: '8px 12px',
                        fontSize: 13,
                        color: 'var(--text-primary)',
                        outline: 'none',
                        cursor: 'pointer',
                        appearance: 'auto',
                      }}
                    >
                      {field.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                );
              }

              return (
                <div
                  key={field.key}
                  className="flex flex-col"
                  style={{ gap: 6, gridColumn: field.half ? undefined : '1 / -1' }}
                >
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>{field.label}</label>
                  {field.description && (
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: -4 }}>{field.description}</span>
                  )}
                  <input
                    type="text"
                    inputMode={field.type === 'number' ? 'decimal' : undefined}
                    placeholder={field.placeholder}
                    value={localValues[field.key] ?? values[field.key] ?? ''}
                    onChange={(e) => onFieldChange(field.key, e.target.value)}
                    className="bg-transparent outline-none input-glow"
                    style={{
                      backgroundColor: 'var(--input-bg)',
                      border: '1px solid var(--input-border)',
                      borderRadius: 4,
                      padding: '8px 12px',
                      fontSize: 13,
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────

export function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('airline');

  const fetchSettings = useCallback(async () => {
    try {
      const res = await api.get<VaSettingsResponse>('/api/admin/settings');
      const map: Record<string, string> = {};
      for (const s of res.settings) {
        map[s.key] = s.value;
      }
      setSettings(map);
      setLocalValues({});
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

  function handleFieldChange(key: string, value: string) {
    setLocalValues((prev) => ({ ...prev, [key]: value }));
  }

  // Check if any values have changed
  const hasChanges = Object.keys(localValues).some(
    (key) => localValues[key] !== (settings[key] ?? ''),
  );

  async function handleSaveAll() {
    if (!hasChanges) return;
    setSaving(true);
    try {
      const payload = Object.entries(localValues)
        .filter(([key, val]) => val !== (settings[key] ?? ''))
        .map(([key, value]) => ({ key, value }));

      if (payload.length === 0) return;

      await api.put('/api/admin/settings', { settings: payload });

      // Update local state to reflect saved values
      setSettings((prev) => {
        const next = { ...prev };
        for (const item of payload) {
          next[item.key] = item.value;
        }
        return next;
      });
      setLocalValues({});
      toast.success('Settings saved');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to save settings';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────

  return (
    <motion.div className="flex flex-col h-full" variants={pageVariants} initial="hidden" animate="visible">
      {/* Header */}
      <motion.div className="flex flex-col" style={{ padding: '16px 24px', gap: 16 }} variants={fadeUp}>
        {/* Title row */}
        <div className="flex items-center" style={{ gap: 12 }}>
          <Settings size={20} style={{ color: 'var(--accent-blue)' }} />
          <div className="flex flex-col" style={{ gap: 2 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Settings</span>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Configure airline operations and system preferences</span>
          </div>
          <div className="flex-1" />
          <button
            onClick={handleSaveAll}
            disabled={!hasChanges || saving}
            className="flex items-center btn-glow"
            style={{
              gap: 6,
              padding: '8px 16px',
              borderRadius: 6,
              backgroundColor: hasChanges ? 'var(--accent-blue)' : 'var(--surface-3)',
              color: hasChanges ? '#fff' : 'var(--text-quaternary)',
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              cursor: hasChanges ? 'pointer' : 'default',
              opacity: saving ? 0.6 : 1,
              transition: 'background-color 200ms, color 200ms',
            }}
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={14} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </motion.div>

      {/* Body */}
      {loading ? (
        <SettingsPageSkeleton />
      ) : error ? (
        <div className="flex items-center justify-center flex-1" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          {error}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto" style={{ padding: '0 24px 24px 24px' }}>
          <motion.div className="flex flex-col" style={{ gap: 8, maxWidth: 720 }} variants={staggerContainer} initial="hidden" animate="visible">
            {SECTIONS.map((section) => (
              <motion.div key={section.id} variants={staggerItem} whileHover={cardHover}>
                <AccordionSection
                  section={section}
                  expanded={expandedSection === section.id}
                  onToggle={() =>
                    setExpandedSection((prev) => (prev === section.id ? null : section.id))
                  }
                  values={settings}
                  localValues={localValues}
                  onFieldChange={handleFieldChange}
                />
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
