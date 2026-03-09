import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { DollarSign, Save, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { pageVariants, staggerContainer, staggerItem } from '@/lib/motion';
import { SectionHeader } from '@/components/primitives';
import { Surface } from '@/components/primitives/Surface';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

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
  reference_nm: number;
  updated_at: string;
}

type YieldField =
  | 'class_i_standard' | 'class_i_nonstandard' | 'class_i_hazard'
  | 'class_ii_standard' | 'class_ii_nonstandard' | 'class_ii_hazard'
  | 'class_iii_standard' | 'class_iii_nonstandard' | 'class_iii_hazard';

const YIELD_ROWS: { label: string; prefix: 'class_i' | 'class_ii' | 'class_iii' }[] = [
  { label: 'Class I', prefix: 'class_i' },
  { label: 'Class II', prefix: 'class_ii' },
  { label: 'Class III', prefix: 'class_iii' },
];

const YIELD_COLS: { label: string; suffix: 'standard' | 'nonstandard' | 'hazard' }[] = [
  { label: 'Standard', suffix: 'standard' },
  { label: 'Non-Standard', suffix: 'nonstandard' },
  { label: 'Hazard', suffix: 'hazard' },
];

// ── Component ───────────────────────────────────────────────

export function RevenueModelPage() {
  const [config, setConfig] = useState<RevenueModelConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Draft state for edits
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

  const manifestSum = (() => {
    const s = Number(draft.manifest_std_pct ?? 0);
    const n = Number(draft.manifest_nonstd_pct ?? 0);
    const h = Number(draft.manifest_hazard_pct ?? 0);
    return Math.round((s + n + h) * 1000) / 1000;
  })();

  const manifestValid = Math.abs(manifestSum - 1) < 0.001;

  const handleSave = async () => {
    if (!manifestValid) {
      toast.error('Manifest split must sum to 100%');
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

  return (
    <motion.div
      className="flex flex-col gap-6 p-6 overflow-y-auto h-full"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
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
            <p
              style={{
                fontSize: 'var(--text-caption-size)',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-sans)',
                margin: 0,
              }}
            >
              Configure cargo yield rates, pilot pay, and manifest distribution
            </p>
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || !manifestValid}
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

      {/* Content grid */}
      <motion.div
        className="grid gap-6"
        style={{ gridTemplateColumns: '1fr 1fr' }}
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {/* ── Yield Matrix ──────────────────────────────── */}
        <motion.div variants={staggerItem} style={{ gridColumn: '1 / -1' }}>
          <Surface elevation={1} padding="spacious">
            <SectionHeader title="Yield Matrix" />
            <p
              style={{
                fontSize: 'var(--text-caption-size)',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-sans)',
                marginBottom: 16,
              }}
            >
              Revenue per kilogram by cargo class and commodity type
            </p>

            {/* Table header */}
            <div
              className="grid gap-3 mb-2"
              style={{ gridTemplateColumns: '120px 1fr 1fr 1fr' }}
            >
              <div />
              {YIELD_COLS.map((col) => (
                <div
                  key={col.suffix}
                  style={{
                    fontSize: 'var(--text-caption-size)',
                    fontWeight: 600,
                    color: 'var(--text-tertiary)',
                    fontFamily: 'var(--font-sans)',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    textAlign: 'center',
                  }}
                >
                  {col.label}
                </div>
              ))}
            </div>

            {/* Table rows */}
            {YIELD_ROWS.map((row) => (
              <div
                key={row.prefix}
                className="grid gap-3 mb-3 items-center"
                style={{ gridTemplateColumns: '120px 1fr 1fr 1fr' }}
              >
                <Label
                  style={{
                    fontSize: 'var(--text-body-size)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 500,
                  }}
                >
                  {row.label}
                </Label>
                {YIELD_COLS.map((col) => {
                  const field = `${row.prefix}_${col.suffix}` as YieldField;
                  return (
                    <div key={field} className="relative">
                      <span
                        className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                        style={{
                          fontSize: 'var(--text-caption-size)',
                          color: 'var(--text-tertiary)',
                        }}
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
                        style={{
                          paddingLeft: 24,
                          background: 'var(--input-bg)',
                          borderColor: 'var(--input-border)',
                          color: 'var(--text-primary)',
                          fontFamily: 'var(--font-sans)',
                          fontSize: 'var(--text-body-size)',
                        }}
                      />
                      <span
                        className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                        style={{
                          fontSize: 'var(--text-caption-size)',
                          color: 'var(--text-tertiary)',
                        }}
                      >
                        /kg
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </Surface>
        </motion.div>

        {/* ── Pilot Pay ──────────────────────────────── */}
        <motion.div variants={staggerItem}>
          <Surface elevation={1} padding="spacious">
            <SectionHeader title="Pilot Pay" />
            <div className="flex flex-col gap-2">
              <Label
                style={{
                  fontSize: 'var(--text-caption-size)',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Pay Rate
              </Label>
              <div className="relative">
                <span
                  className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{
                    fontSize: 'var(--text-caption-size)',
                    color: 'var(--text-tertiary)',
                  }}
                >
                  $
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={draft.pilot_pay_per_hour ?? ''}
                  onChange={(e) => updateField('pilot_pay_per_hour', e.target.value)}
                  className="text-right"
                  style={{
                    paddingLeft: 24,
                    background: 'var(--input-bg)',
                    borderColor: 'var(--input-border)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 'var(--text-body-size)',
                  }}
                />
                <span
                  className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{
                    fontSize: 'var(--text-caption-size)',
                    color: 'var(--text-tertiary)',
                  }}
                >
                  /hr
                </span>
              </div>
            </div>
          </Surface>
        </motion.div>

        {/* ── Distance Reference ──────────────────────── */}
        <motion.div variants={staggerItem}>
          <Surface elevation={1} padding="spacious">
            <SectionHeader title="Distance Reference" />
            <div className="flex flex-col gap-2">
              <Label
                style={{
                  fontSize: 'var(--text-caption-size)',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Reference Distance
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={draft.reference_nm ?? ''}
                  onChange={(e) => updateField('reference_nm', e.target.value)}
                  className="text-right"
                  style={{
                    background: 'var(--input-bg)',
                    borderColor: 'var(--input-border)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 'var(--text-body-size)',
                    paddingRight: 36,
                  }}
                />
                <span
                  className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{
                    fontSize: 'var(--text-caption-size)',
                    color: 'var(--text-tertiary)',
                  }}
                >
                  nm
                </span>
              </div>
            </div>
          </Surface>
        </motion.div>

        {/* ── Manifest Split ──────────────────────────── */}
        <motion.div variants={staggerItem} style={{ gridColumn: '1 / -1' }}>
          <Surface elevation={1} padding="spacious">
            <SectionHeader
              title="Manifest Split"
              action={
                <span
                  style={{
                    fontSize: 'var(--text-caption-size)',
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 600,
                    color: manifestValid ? 'var(--accent-emerald)' : 'var(--accent-red)',
                  }}
                >
                  Total: {(manifestSum * 100).toFixed(1)}%
                  {manifestValid ? ' \u2713' : ' (must equal 100%)'}
                </span>
              }
            />
            <p
              style={{
                fontSize: 'var(--text-caption-size)',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-sans)',
                marginBottom: 16,
              }}
            >
              Distribution of cargo types in generated manifests (must sum to 100%)
            </p>

            <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              {([
                { label: 'Standard', field: 'manifest_std_pct' as const },
                { label: 'Non-Standard', field: 'manifest_nonstd_pct' as const },
                { label: 'Hazard', field: 'manifest_hazard_pct' as const },
              ]).map(({ label, field }) => {
                const rawValue = (draft as Record<string, unknown>)[field];
                const displayValue = rawValue !== undefined && rawValue !== ''
                  ? (Number(rawValue) * 100).toFixed(1)
                  : '';
                return (
                  <div key={field} className="flex flex-col gap-2">
                    <Label
                      style={{
                        fontSize: 'var(--text-caption-size)',
                        color: 'var(--text-secondary)',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {label}
                    </Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={displayValue}
                        onChange={(e) => {
                          const pct = e.target.value;
                          const decimal = pct === '' ? '' : String(Number(pct) / 100);
                          updateField(field, decimal);
                        }}
                        className="text-right"
                        style={{
                          background: 'var(--input-bg)',
                          borderColor: manifestValid ? 'var(--input-border)' : 'var(--accent-red)',
                          color: 'var(--text-primary)',
                          fontFamily: 'var(--font-sans)',
                          fontSize: 'var(--text-body-size)',
                          paddingRight: 28,
                        }}
                      />
                      <span
                        className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                        style={{
                          fontSize: 'var(--text-caption-size)',
                          color: 'var(--text-tertiary)',
                        }}
                      >
                        %
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Surface>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
