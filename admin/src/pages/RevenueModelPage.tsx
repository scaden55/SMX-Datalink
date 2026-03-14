import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { DollarSign, Save, Loader2, Info } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { pageVariants, staggerContainer, staggerItem } from '@/lib/motion';
import { SectionHeader } from '@/components/primitives';
import { Surface } from '@/components/primitives/Surface';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ── Types ───────────────────────────────────────────────────

interface RevenueModelConfig {
  id: number;
  class_i_standard: number;
  class_i_nonstandard: number;
  class_i_hazard: number;
  class_ii_standard: number;
  class_ii_nonstandard: number;
  class_ii_hazard: number;
  class_iii_standard: number;
  class_iii_nonstandard: number;
  class_iii_hazard: number;
  pilot_pay_per_hour: number;
  manifest_std_pct: number;
  manifest_nonstd_pct: number;
  manifest_hazard_pct: number;
  manifest_std_min: number;
  manifest_std_max: number;
  manifest_nonstd_min: number;
  manifest_nonstd_max: number;
  manifest_hazard_min: number;
  manifest_hazard_max: number;
  reference_nm: number;
  updated_at: string;
}

type YieldField =
  | 'class_i_standard' | 'class_i_nonstandard' | 'class_i_hazard'
  | 'class_ii_standard' | 'class_ii_nonstandard' | 'class_ii_hazard'
  | 'class_iii_standard' | 'class_iii_nonstandard' | 'class_iii_hazard';

// ── Fare schedule reference ─────────────────────────────────

const FARE_TABLE: {
  code: string;
  label: string;
  classLabel: string;
  prefix: 'class_i' | 'class_ii' | 'class_iii';
  suffix: 'standard' | 'nonstandard' | 'hazard';
}[] = [
  { code: '1US', label: 'Unit Standard', classLabel: 'Class I', prefix: 'class_i', suffix: 'standard' },
  { code: '1UN', label: 'Unit Non-Standard', classLabel: 'Class I', prefix: 'class_i', suffix: 'nonstandard' },
  { code: '1HX', label: 'Unit Hazard', classLabel: 'Class I', prefix: 'class_i', suffix: 'hazard' },
  { code: '2US', label: 'Unit Standard', classLabel: 'Class II', prefix: 'class_ii', suffix: 'standard' },
  { code: '2UN', label: 'Unit Non-Standard', classLabel: 'Class II', prefix: 'class_ii', suffix: 'nonstandard' },
  { code: '2HX', label: 'Unit Hazard', classLabel: 'Class II', prefix: 'class_ii', suffix: 'hazard' },
  { code: '3US', label: 'Unit Standard', classLabel: 'Class III', prefix: 'class_iii', suffix: 'standard' },
  { code: '3UN', label: 'Unit Non-Standard', classLabel: 'Class III', prefix: 'class_iii', suffix: 'nonstandard' },
  { code: '3HX', label: 'Unit Hazard', classLabel: 'Class III', prefix: 'class_iii', suffix: 'hazard' },
];

const MANIFEST_ROWS = [
  { label: 'Standard', minField: 'manifest_std_min' as const, maxField: 'manifest_std_max' as const },
  { label: 'Non-Standard', minField: 'manifest_nonstd_min' as const, maxField: 'manifest_nonstd_max' as const },
  { label: 'Hazard', minField: 'manifest_hazard_min' as const, maxField: 'manifest_hazard_max' as const },
];

// ── Helpers ─────────────────────────────────────────────────

function InfoTip({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info size={13} style={{ color: 'var(--text-tertiary)', cursor: 'help', flexShrink: 0 }} />
        </TooltipTrigger>
        <TooltipContent
          side="top"
          style={{
            maxWidth: 280,
            background: 'var(--surface-3)',
            border: '1px solid var(--border-secondary)',
            color: 'var(--text-primary)',
            fontSize: 'var(--text-caption-size)',
            fontFamily: 'var(--font-sans)',
            lineHeight: 1.5,
            padding: '8px 12px',
          }}
        >
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const inputStyle = {
  background: 'var(--input-bg)',
  borderColor: 'var(--input-border)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--text-body-size)',
} as const;

const captionStyle = {
  fontSize: 'var(--text-caption-size)',
  color: 'var(--text-secondary)',
  fontFamily: 'var(--font-sans)',
} as const;

const suffixStyle = {
  fontSize: 'var(--text-caption-size)',
  color: 'var(--text-tertiary)',
} as const;

// ── Component ───────────────────────────────────────────────

export function RevenueModelPage() {
  const [config, setConfig] = useState<RevenueModelConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Partial<RevenueModelConfig>>({});

  useEffect(() => {
    api
      .get<RevenueModelConfig>('/api/admin/revenue-model')
      .then((data) => {
        setConfig(data);
        setDraft(data);
      })
      .catch(() => toast.error('Failed to load revenue model config'))
      .finally(() => setLoading(false));
  }, []);

  const updateField = (field: keyof RevenueModelConfig, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value === '' ? '' : Number(value) }));
  };

  const manifestValid =
    Number(draft.manifest_std_min ?? 0) <= Number(draft.manifest_std_max ?? 0) &&
    Number(draft.manifest_nonstd_min ?? 0) <= Number(draft.manifest_nonstd_max ?? 0) &&
    Number(draft.manifest_hazard_min ?? 0) <= Number(draft.manifest_hazard_max ?? 0);

  const handleSave = async () => {
    if (!manifestValid) {
      toast.error('Manifest split: min must be ≤ max for each tier');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, number> = {};
      const fields = [
        'class_i_standard', 'class_i_nonstandard', 'class_i_hazard',
        'class_ii_standard', 'class_ii_nonstandard', 'class_ii_hazard',
        'class_iii_standard', 'class_iii_nonstandard', 'class_iii_hazard',
        'pilot_pay_per_hour',
        'manifest_std_pct', 'manifest_nonstd_pct', 'manifest_hazard_pct',
        'manifest_std_min', 'manifest_std_max',
        'manifest_nonstd_min', 'manifest_nonstd_max',
        'manifest_hazard_min', 'manifest_hazard_max',
        'reference_nm',
      ] as const;
      for (const f of fields) {
        const v = (draft as Record<string, unknown>)[f];
        if (v !== undefined && v !== '') payload[f] = Number(v);
      }
      const updated = await api.put<RevenueModelConfig>('/api/admin/revenue-model', payload);
      setConfig(updated);
      setDraft(updated);
      toast.success('Revenue model saved');
    } catch {
      toast.error('Failed to save revenue model');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--text-tertiary)' }} />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center h-full">
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-body-size)' }}>
          No revenue model configuration found.
        </p>
      </div>
    );
  }

  // Group fare table by class for the matrix display
  const faresByClass = [
    { classLabel: 'Class I', rows: FARE_TABLE.filter((f) => f.prefix === 'class_i') },
    { classLabel: 'Class II', rows: FARE_TABLE.filter((f) => f.prefix === 'class_ii') },
    { classLabel: 'Class III', rows: FARE_TABLE.filter((f) => f.prefix === 'class_iii') },
  ];

  return (
    <motion.div
      className="flex flex-col gap-6 p-6 overflow-y-auto h-full"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      {/* ── Page Header ──────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center rounded-lg"
            style={{
              width: 36,
              height: 36,
              background: 'var(--accent-blue-bg)',
              color: 'var(--accent-blue)',
            }}
          >
            <DollarSign size={20} />
          </div>
          <div>
            <h1
              style={{
                fontSize: 'var(--text-display-size)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              Revenue Model
            </h1>
            <p style={{ ...captionStyle, margin: 0 }}>
              Cargo fare rates, manifest distribution, and operational parameters
            </p>
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || !manifestValid}
          className="gap-2"
          style={{
            background: 'var(--accent-blue)',
            color: '#fff',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* ── Main content: two-column layout ──────────────── */}
      <motion.div
        className="grid gap-6"
        style={{ gridTemplateColumns: '1fr 340px' }}
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {/* ════════ LEFT: Fare Schedule ════════ */}
        <motion.div variants={staggerItem} className="flex flex-col gap-6">
          <Surface elevation={1} padding="spacious">
            <div className="flex items-center gap-2 mb-1">
              <SectionHeader title="Fare Schedule" className="border-0 mb-0 pb-0" />
              <InfoTip text="Published cargo rates per pound for each aircraft class and commodity type. These rates are multiplied by a distance factor based on route length." />
            </div>
            <p style={{ ...captionStyle, marginBottom: 20 }}>
              Active cargo rates by class and commodity type
            </p>

            {/* ── Fare table ── */}
            <div
              className="rounded-lg overflow-hidden"
              style={{ border: '1px solid var(--border-primary)' }}
            >
              {/* Table header */}
              <div
                className="grid items-center"
                style={{
                  gridTemplateColumns: '72px 1fr 1fr',
                  padding: '10px 16px',
                  background: 'var(--surface-3)',
                  borderBottom: '1px solid var(--border-primary)',
                }}
              >
                <span style={{ ...suffixStyle, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Code
                </span>
                <span style={{ ...suffixStyle, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Description
                </span>
                <span style={{ ...suffixStyle, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'right' }}>
                  Rate ($/lb)
                </span>
              </div>

              {/* Table body grouped by class */}
              {faresByClass.map((group, gi) => (
                <div key={group.classLabel}>
                  {/* Class group header */}
                  <div
                    style={{
                      padding: '8px 16px',
                      background: 'rgba(79, 108, 205, 0.04)',
                      borderBottom: '1px solid var(--border-primary)',
                      ...(gi > 0 ? { borderTop: '1px solid var(--border-primary)' } : {}),
                    }}
                  >
                    <span style={{
                      fontSize: 'var(--text-caption-size)',
                      fontWeight: 600,
                      color: 'var(--accent-blue)',
                      fontFamily: 'var(--font-sans)',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}>
                      {group.classLabel}
                    </span>
                  </div>
                  {/* Rows */}
                  {group.rows.map((fare, ri) => {
                    const field = `${fare.prefix}_${fare.suffix}` as YieldField;
                    const isLast = ri === group.rows.length - 1 && gi === faresByClass.length - 1;
                    return (
                      <div
                        key={fare.code}
                        className="grid items-center"
                        style={{
                          gridTemplateColumns: '72px 1fr 1fr',
                          padding: '8px 16px',
                          borderBottom: isLast ? 'none' : '1px solid var(--border-primary)',
                        }}
                      >
                        <span style={{
                          fontSize: 'var(--text-body-size)',
                          fontFamily: 'var(--font-sans)',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                        }}>
                          {fare.code}
                        </span>
                        <span style={{
                          fontSize: 'var(--text-body-size)',
                          fontFamily: 'var(--font-sans)',
                          color: 'var(--text-secondary)',
                        }}>
                          {fare.label}
                        </span>
                        <div className="relative" style={{ maxWidth: 160, marginLeft: 'auto' }}>
                          <span
                            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                            style={suffixStyle}
                          >
                            $
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={String((draft as Record<string, unknown>)[field] ?? '')}
                            onChange={(e) => updateField(field, e.target.value)}
                            className="text-right"
                            style={{ ...inputStyle, paddingLeft: 24, paddingRight: 36 }}
                          />
                          <span
                            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                            style={suffixStyle}
                          >
                            /lb
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {config.updated_at && (
              <p style={{ ...captionStyle, marginTop: 12, color: 'var(--text-tertiary)' }}>
                Last updated: {new Date(config.updated_at + 'Z').toLocaleDateString('en-US', {
                  year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            )}
          </Surface>
        </motion.div>

        {/* ════════ RIGHT: Operational Parameters ════════ */}
        <motion.div variants={staggerItem} className="flex flex-col gap-5">

          {/* ── Manifest Distribution ──────────────────── */}
          <Surface elevation={1} padding="spacious">
            <div className="flex items-center gap-2 mb-1">
              <SectionHeader title="Manifest Distribution" className="border-0 mb-0 pb-0" />
              <InfoTip text="When a flight completes, cargo is randomly split across these types within the configured ranges, then normalized to 100%. This simulates a realistic cargo mix." />
            </div>
            <p style={{ ...captionStyle, marginBottom: 16 }}>
              Randomized cargo type split per flight
            </p>

            {!manifestValid && (
              <div
                className="rounded-md mb-3"
                style={{
                  padding: '8px 12px',
                  background: 'var(--accent-red-bg)',
                  fontSize: 'var(--text-caption-size)',
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--accent-red)',
                  fontWeight: 500,
                }}
              >
                Min must be ≤ Max for each tier
              </div>
            )}

            <div className="flex flex-col gap-3">
              {MANIFEST_ROWS.map(({ label, minField, maxField }) => {
                const minVal = (draft as Record<string, unknown>)[minField];
                const maxVal = (draft as Record<string, unknown>)[maxField];
                const minDisplay = minVal !== undefined && minVal !== '' ? (Number(minVal) * 100).toFixed(0) : '';
                const maxDisplay = maxVal !== undefined && maxVal !== '' ? (Number(maxVal) * 100).toFixed(0) : '';
                const rowInvalid = Number(minVal ?? 0) > Number(maxVal ?? 0);
                const borderColor = rowInvalid ? 'var(--accent-red)' : 'var(--input-border)';
                return (
                  <div key={minField}>
                    <div style={{ ...captionStyle, marginBottom: 6, fontWeight: 500, color: 'var(--text-primary)' }}>
                      {label}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          max="100"
                          value={minDisplay}
                          onChange={(e) => {
                            const pct = e.target.value;
                            updateField(minField, pct === '' ? '' : String(Number(pct) / 100));
                          }}
                          className="text-right"
                          style={{ ...inputStyle, borderColor, paddingRight: 28 }}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={suffixStyle}>%</span>
                      </div>
                      <span style={{ ...suffixStyle, flexShrink: 0 }}>to</span>
                      <div className="relative flex-1">
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          max="100"
                          value={maxDisplay}
                          onChange={(e) => {
                            const pct = e.target.value;
                            updateField(maxField, pct === '' ? '' : String(Number(pct) / 100));
                          }}
                          className="text-right"
                          style={{ ...inputStyle, borderColor, paddingRight: 28 }}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={suffixStyle}>%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Surface>

          {/* ── Pilot Pay ──────────────────────────────── */}
          <Surface elevation={1} padding="spacious">
            <div className="flex items-center gap-2 mb-1">
              <SectionHeader title="Pilot Pay" className="border-0 mb-0 pb-0" />
              <InfoTip text="Hourly rate paid to pilots on completion of a flight. Multiplied by block hours to calculate total pilot pay per PIREP." />
            </div>
            <p style={{ ...captionStyle, marginBottom: 12 }}>
              Base hourly rate
            </p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={suffixStyle}>$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={draft.pilot_pay_per_hour ?? ''}
                onChange={(e) => updateField('pilot_pay_per_hour', e.target.value)}
                className="text-right"
                style={{ ...inputStyle, paddingLeft: 24, paddingRight: 36 }}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={suffixStyle}>/hr</span>
            </div>
          </Surface>

          {/* ── Distance Reference ──────────────────────── */}
          <Surface elevation={1} padding="spacious">
            <div className="flex items-center gap-2 mb-1">
              <SectionHeader title="Distance Factor" className="border-0 mb-0 pb-0" />
              <InfoTip text="The baseline route distance used to scale revenue. A route matching this distance earns the exact yield rate. Shorter routes earn less per lb, longer routes earn more — but with diminishing returns (logarithmic curve). Raise this if your network is mostly long-haul." />
            </div>
            <p style={{ ...captionStyle, marginBottom: 12 }}>
              Baseline distance for revenue scaling
            </p>
            <div className="relative">
              <Input
                type="number"
                step="1"
                min="0"
                value={draft.reference_nm ?? ''}
                onChange={(e) => updateField('reference_nm', e.target.value)}
                className="text-right"
                style={{ ...inputStyle, paddingRight: 36 }}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={suffixStyle}>nm</span>
            </div>
          </Surface>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
