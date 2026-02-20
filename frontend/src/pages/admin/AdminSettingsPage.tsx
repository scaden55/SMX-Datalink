import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Settings,
  Save,
  Loader2,
  Check,
  AlertTriangle,
  Building2,
  ClipboardCheck,
  DollarSign,
  Ticket,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '../../lib/api';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import type { VaSetting, VaSettingsResponse } from '@acars/shared';

// ─── Types ──────────────────────────────────────────────────────

interface Toast {
  type: 'success' | 'error';
  message: string;
}

interface SettingMeta {
  updatedBy: number | null;
  updatedAt: string | null;
}

interface SectionSaveState {
  saving: boolean;
  saved: boolean;
}

// ─── Setting Definitions ────────────────────────────────────────

interface SettingDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean';
  placeholder?: string;
  prefix?: string;
  step?: string;
}

interface SectionDef {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  iconColor: string;
  fields: SettingDef[];
}

const SECTIONS: SectionDef[] = [
  {
    id: 'identity',
    title: 'VA Identity',
    description: 'Core virtual airline branding and identification.',
    icon: Building2,
    iconColor: 'text-acars-blue',
    fields: [
      { key: 'va.name', label: 'VA Name', type: 'text', placeholder: 'SMA Virtual' },
      { key: 'va.icao', label: 'ICAO Code', type: 'text', placeholder: 'SMA' },
    ],
  },
  {
    id: 'pirep',
    title: 'PIREP Settings',
    description: 'Configure how pilot reports are processed and scored.',
    icon: ClipboardCheck,
    iconColor: 'text-acars-green',
    fields: [
      { key: 'pirep.auto_approve', label: 'Auto-Approve PIREPs', type: 'boolean' },
      { key: 'pirep.min_score', label: 'Minimum Score for Auto-Approve', type: 'number', placeholder: '0' },
    ],
  },
  {
    id: 'finance',
    title: 'Financial Rates',
    description: 'Set pay rates and cargo/passenger revenue multipliers.',
    icon: DollarSign,
    iconColor: 'text-acars-amber',
    fields: [
      { key: 'finance.pay_per_hour', label: 'Pay per Flight Hour', type: 'number', placeholder: '50.00', prefix: '$', step: '0.01' },
      { key: 'finance.cargo_rate', label: 'Cargo Rate per lb', type: 'number', placeholder: '0.0005', prefix: '$', step: '0.0001' },
      { key: 'finance.pax_rate', label: 'Passenger Rate per pax', type: 'number', placeholder: '0.12', prefix: '$', step: '0.01' },
    ],
  },
  {
    id: 'bid',
    title: 'Bid Settings',
    description: 'Control how many active bids a pilot may hold.',
    icon: Ticket,
    iconColor: 'text-acars-blue',
    fields: [
      { key: 'bid.max_active', label: 'Max Active Bids per Pilot', type: 'number', placeholder: '5' },
    ],
  },
];

const ALL_KEYS = SECTIONS.flatMap((s) => s.fields.map((f) => f.key));

// ─── Helpers ────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' at ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  );
}

// ─── Toggle Switch ──────────────────────────────────────────────

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (val: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex items-center w-11 h-[22px] rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-acars-blue/40 ${
        checked ? 'bg-acars-blue' : 'bg-acars-border'
      }`}
    >
      <span
        className={`inline-block w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-[24px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  );
}

// ─── Toast Component ────────────────────────────────────────────

function ToastNotification({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg border text-sm animate-in fade-in slide-in-from-top-2 ${
        toast.type === 'success'
          ? 'bg-acars-green/10 border-acars-green/30 text-acars-green'
          : 'bg-acars-red/10 border-acars-red/30 text-acars-red'
      }`}
    >
      {toast.type === 'success' ? (
        <Check className="w-4 h-4 shrink-0" />
      ) : (
        <AlertTriangle className="w-4 h-4 shrink-0" />
      )}
      {toast.message}
    </div>
  );
}

// ─── Number Input with Prefix ───────────────────────────────────

function PrefixedInput({
  value,
  onChange,
  placeholder,
  prefix,
  step,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  prefix?: string;
  step?: string;
}) {
  if (!prefix) {
    return (
      <input
        type="number"
        value={value}
        placeholder={placeholder}
        step={step}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#0d1117] border border-acars-border rounded px-3 py-1.5 text-sm text-acars-text focus:border-acars-blue focus:outline-none"
      />
    );
  }

  return (
    <div className="relative flex items-stretch">
      <span className="flex items-center justify-center px-2.5 bg-[#161b22] border border-r-0 border-acars-border rounded-l text-xs text-acars-muted font-medium select-none">
        {prefix}
      </span>
      <input
        type="number"
        value={value}
        placeholder={placeholder}
        step={step}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-[#0d1117] border border-acars-border rounded-r px-3 py-1.5 text-sm text-acars-text focus:border-acars-blue focus:outline-none min-w-0"
      />
    </div>
  );
}

// ─── Section Card ───────────────────────────────────────────────

function SectionCard({
  section,
  values,
  meta,
  saveState,
  onValueChange,
  onSave,
}: {
  section: SectionDef;
  values: Record<string, string>;
  meta: Record<string, SettingMeta>;
  saveState: SectionSaveState;
  onValueChange: (key: string, value: string) => void;
  onSave: (sectionId: string) => void;
}) {
  const Icon = section.icon;

  // Find most recent updatedAt across this section's fields
  let latestMeta: SettingMeta | null = null;
  for (const field of section.fields) {
    const m = meta[field.key];
    if (m?.updatedAt) {
      if (!latestMeta || !latestMeta.updatedAt || m.updatedAt > latestMeta.updatedAt) {
        latestMeta = m;
      }
    }
  }

  return (
    <div className="panel rounded-lg border border-acars-border overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-acars-border/50 bg-[#0d1117]/40">
        <div className={`flex items-center justify-center w-8 h-8 rounded-md bg-[#1c2433] ${section.iconColor}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-acars-text">{section.title}</h3>
          <p className="text-[11px] text-acars-muted mt-0.5">{section.description}</p>
        </div>
      </div>

      {/* Fields */}
      <div className="px-5 py-4 space-y-4">
        {section.fields.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <label className="block text-xs font-medium text-acars-muted">{field.label}</label>

            {field.type === 'boolean' ? (
              <div className="flex items-center gap-3">
                <ToggleSwitch
                  checked={values[field.key] === 'true'}
                  onChange={(val) => onValueChange(field.key, val ? 'true' : 'false')}
                />
                <span className="text-xs text-acars-muted">
                  {values[field.key] === 'true' ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            ) : field.type === 'number' ? (
              <PrefixedInput
                value={values[field.key] ?? ''}
                onChange={(val) => onValueChange(field.key, val)}
                placeholder={field.placeholder}
                prefix={field.prefix}
                step={field.step}
              />
            ) : (
              <input
                type="text"
                value={values[field.key] ?? ''}
                placeholder={field.placeholder}
                onChange={(e) => onValueChange(field.key, e.target.value)}
                className="w-full bg-[#0d1117] border border-acars-border rounded px-3 py-1.5 text-sm text-acars-text focus:border-acars-blue focus:outline-none"
              />
            )}
          </div>
        ))}
      </div>

      {/* Footer: metadata + save button */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-acars-border/50 bg-[#0d1117]/20">
        <div className="text-[10px] text-acars-muted/60">
          {latestMeta?.updatedAt ? (
            <>
              Last updated
              {latestMeta.updatedBy != null && ` by user #${latestMeta.updatedBy}`}
              {' '}
              {formatDate(latestMeta.updatedAt)}
            </>
          ) : (
            <span className="text-acars-muted/40">No changes recorded</span>
          )}
        </div>
        <button
          onClick={() => onSave(section.id)}
          disabled={saveState.saving}
          className="inline-flex items-center gap-1.5 bg-acars-blue hover:bg-acars-blue/80 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium px-4 py-1.5 rounded transition-colors"
        >
          {saveState.saving ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Saving...
            </>
          ) : saveState.saved ? (
            <>
              <Check className="w-3.5 h-3.5" />
              Saved!
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5" />
              Save
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────

export function AdminSettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [meta, setMeta] = useState<Record<string, SettingMeta>>({});
  const [loading, setLoading] = useState(true);
  const [sectionStates, setSectionStates] = useState<Record<string, SectionSaveState>>({});
  const [toast, setToast] = useState<Toast | null>(null);
  const savedTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── Cleanup saved-state timers on unmount ────────────────────
  useEffect(() => {
    return () => {
      for (const timer of Object.values(savedTimers.current)) {
        clearTimeout(timer);
      }
    };
  }, []);

  // ── Get section save state ───────────────────────────────────
  const getSectionState = useCallback(
    (sectionId: string): SectionSaveState => sectionStates[sectionId] ?? { saving: false, saved: false },
    [sectionStates],
  );

  // ── Fetch settings ───────────────────────────────────────────

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<VaSettingsResponse>('/api/admin/settings');
      const vals: Record<string, string> = {};
      const m: Record<string, SettingMeta> = {};

      for (const s of data.settings) {
        // Map backend key `bids.max_active` to our local key `bid.max_active`
        const localKey = s.key === 'bids.max_active' ? 'bid.max_active' : s.key;
        vals[localKey] = s.value;
        m[localKey] = { updatedBy: s.updatedBy ?? null, updatedAt: s.updatedAt ?? null };
      }

      // Fill missing keys with empty defaults
      for (const key of ALL_KEYS) {
        if (!(key in vals)) {
          vals[key] = '';
        }
      }

      setValues(vals);
      setMeta(m);
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // ── Update a value locally ───────────────────────────────────

  const handleValueChange = useCallback((key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    // Clear any existing "saved" state when the user edits a field
    // We don't know which section this key belongs to without a lookup,
    // but it's fine -- the next save will show the correct state.
  }, []);

  // ── Save a section ───────────────────────────────────────────

  const handleSave = useCallback(
    async (sectionId: string) => {
      const section = SECTIONS.find((s) => s.id === sectionId);
      if (!section) return;

      // Build payload, mapping local keys back to backend keys
      const payload = section.fields.map((f) => ({
        key: f.key === 'bid.max_active' ? 'bids.max_active' : f.key,
        value: values[f.key] ?? '',
      }));

      try {
        // Mark section as saving
        setSectionStates((prev) => ({
          ...prev,
          [sectionId]: { saving: true, saved: false },
        }));

        await api.put('/api/admin/settings', { settings: payload });

        // Update metadata optimistically (we know the save succeeded)
        const now = new Date().toISOString();
        setMeta((prev) => {
          const next = { ...prev };
          for (const f of section.fields) {
            next[f.key] = { updatedBy: null, updatedAt: now };
          }
          return next;
        });

        // Mark section as saved
        setSectionStates((prev) => ({
          ...prev,
          [sectionId]: { saving: false, saved: true },
        }));

        // Clear the "saved" indicator after 2.5 seconds
        if (savedTimers.current[sectionId]) {
          clearTimeout(savedTimers.current[sectionId]);
        }
        savedTimers.current[sectionId] = setTimeout(() => {
          setSectionStates((prev) => ({
            ...prev,
            [sectionId]: { saving: false, saved: false },
          }));
        }, 2500);

        setToast({ type: 'success', message: `${section.title} saved successfully` });
      } catch (err) {
        setSectionStates((prev) => ({
          ...prev,
          [sectionId]: { saving: false, saved: false },
        }));
        setToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to save settings' });
      }
    },
    [values],
  );

  // ── Dismiss toast ────────────────────────────────────────────

  const dismissToast = useCallback(() => setToast(null), []);

  // ── Loading state ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6">
        <AdminPageHeader icon={Settings} title="VA Settings" subtitle="Configure virtual airline parameters" />
        <div className="flex flex-col items-center justify-center mt-20 gap-3">
          <Loader2 className="w-6 h-6 text-acars-muted animate-spin" />
          <p className="text-xs text-acars-muted">Loading settings...</p>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader icon={Settings} title="VA Settings" subtitle="Configure virtual airline parameters" />

      {toast && <ToastNotification toast={toast} onDismiss={dismissToast} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {SECTIONS.map((section) => (
          <SectionCard
            key={section.id}
            section={section}
            values={values}
            meta={meta}
            saveState={getSectionState(section.id)}
            onValueChange={handleValueChange}
            onSave={handleSave}
          />
        ))}
      </div>
    </div>
  );
}
