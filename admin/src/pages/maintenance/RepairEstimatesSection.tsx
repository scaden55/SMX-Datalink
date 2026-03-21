import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { tableContainer, tableRow } from '@/lib/motion';

// ── Types ────────────────────────────────────────────────────

interface RepairEstimate {
  id: number;
  ata_chapter_prefix: string;
  ata_group_name: string;
  grounding_hours: number;
  grounding_cost: number;
  non_grounding_hours: number;
  non_grounding_cost: number;
  reference_note: string | null;
}

// ── Shared Styles ────────────────────────────────────────────

const COL_HEADER_CLASS = 'text-subheading';
const colHeaderStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderBottom: '1px solid var(--border-primary)',
  userSelect: 'none',
};

const CELL_CLASS = 'text-caption';
const cellStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderBottom: '1px solid var(--border-primary)',
  verticalAlign: 'middle',
};

const MONO_CLASS = 'data-sm';

// ── Skeleton ─────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div style={{ padding: 24 }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 42,
            background: 'transparent',
            border: '1px solid var(--panel-border)',
            borderRadius: 4,
            marginBottom: 4,
            opacity: 0.5,
          }}
          className="animate-pulse"
        />
      ))}
    </div>
  );
}

// ── Inline Editable Cell ─────────────────────────────────────

function EditableCell({
  value,
  onSave,
  format,
}: {
  value: number;
  onSave: (v: number) => void;
  format: 'hours' | 'cost';
}) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function commit() {
    const parsed = parseFloat(localValue);
    if (!isNaN(parsed) && parsed >= 0 && parsed !== value) {
      onSave(parsed);
    }
    setEditing(false);
    setLocalValue(value.toString());
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      commit();
    } else if (e.key === 'Escape') {
      setEditing(false);
      setLocalValue(value.toString());
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        step={format === 'hours' ? '0.5' : '100'}
        min="0"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className={MONO_CLASS}
        style={{
          width: format === 'cost' ? 90 : 70,
          padding: '2px 6px',
          background: 'var(--input-bg)',
          border: '1px solid var(--accent-blue)',
          borderRadius: 3,
          color: 'var(--text-primary)',
          fontSize: 12,
          outline: 'none',
        }}
      />
    );
  }

  const display =
    format === 'cost'
      ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
      : `${value}h`;

  return (
    <span
      onClick={() => {
        setLocalValue(value.toString());
        setEditing(true);
      }}
      className={MONO_CLASS}
      style={{
        cursor: 'pointer',
        padding: '2px 6px',
        borderRadius: 3,
        transition: 'background 80ms',
        color: 'var(--text-primary)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--surface-3)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
      title="Click to edit"
    >
      {display}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
// RepairEstimatesSection
// ═══════════════════════════════════════════════════════════════

export function RepairEstimatesSection({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<RepairEstimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  // ── Fetch ────────────────────────────────────────────────

  const fetchItems = useCallback(async () => {
    try {
      const res = await api.get<RepairEstimate[]>(
        '/api/admin/maintenance/repair-estimates',
      );
      setItems(res);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load repair estimates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems, refreshKey]);

  // ── Save single field ──────────────────────────────────────

  async function handleSave(item: RepairEstimate, field: keyof RepairEstimate, value: number) {
    try {
      const payload = {
        grounding_hours: item.grounding_hours,
        grounding_cost: item.grounding_cost,
        non_grounding_hours: item.non_grounding_hours,
        non_grounding_cost: item.non_grounding_cost,
        [field]: value,
      };
      await api.put(`/api/admin/maintenance/repair-estimates/${item.id}`, payload);
      // Update local state optimistically
      setItems((prev) =>
        prev.map((r) =>
          r.id === item.id ? { ...r, [field]: value } : r,
        ),
      );
      toast.success('Repair estimate updated');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update repair estimate');
    }
  }

  // ── Render ────────────────────────────────────────────────

  if (loading) return <TableSkeleton />;

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div>
        <div className="text-body" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
          Repair Estimates
        </div>
        <div className="text-caption" style={{ marginTop: 4 }}>
          Default labor hours and cost estimates by ATA chapter. Used to calculate work order duration and cost when creating repairs from discrepancies.
        </div>
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <div
          className="text-body"
          style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-tertiary)' }}
        >
          No repair estimates configured.
        </div>
      )}

      {/* Table */}
      {items.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className={COL_HEADER_CLASS} style={colHeaderStyle}>ATA</th>
                <th className={COL_HEADER_CLASS} style={colHeaderStyle}>Group Name</th>
                <th className={COL_HEADER_CLASS} style={{ ...colHeaderStyle, textAlign: 'right' }}>Grounding Hours</th>
                <th className={COL_HEADER_CLASS} style={{ ...colHeaderStyle, textAlign: 'right' }}>Grounding Cost</th>
                <th className={COL_HEADER_CLASS} style={{ ...colHeaderStyle, textAlign: 'right' }}>Non-Grounding Hours</th>
                <th className={COL_HEADER_CLASS} style={{ ...colHeaderStyle, textAlign: 'right' }}>Non-Grounding Cost</th>
                <th className={COL_HEADER_CLASS} style={colHeaderStyle}>Reference</th>
              </tr>
            </thead>
            <motion.tbody variants={tableContainer} initial="hidden" animate="visible">
              {items.map((item) => (
                <motion.tr
                  key={item.id}
                  variants={tableRow}
                  style={{
                    background: hoveredId === item.id ? 'var(--tint-subtle)' : 'transparent',
                    transition: 'background 80ms',
                  }}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* ATA Prefix */}
                  <td
                    className={`${CELL_CLASS} ${MONO_CLASS}`}
                    style={{ ...cellStyle, fontWeight: 600, color: 'var(--text-primary)', width: 60 }}
                  >
                    {item.ata_chapter_prefix}
                  </td>

                  {/* Group Name */}
                  <td className={CELL_CLASS} style={{ ...cellStyle, color: 'var(--text-secondary)' }}>
                    {item.ata_group_name}
                  </td>

                  {/* Grounding Hours */}
                  <td className={CELL_CLASS} style={{ ...cellStyle, textAlign: 'right' }}>
                    <EditableCell
                      value={item.grounding_hours}
                      format="hours"
                      onSave={(v) => handleSave(item, 'grounding_hours', v)}
                    />
                  </td>

                  {/* Grounding Cost */}
                  <td className={CELL_CLASS} style={{ ...cellStyle, textAlign: 'right' }}>
                    <EditableCell
                      value={item.grounding_cost}
                      format="cost"
                      onSave={(v) => handleSave(item, 'grounding_cost', v)}
                    />
                  </td>

                  {/* Non-Grounding Hours */}
                  <td className={CELL_CLASS} style={{ ...cellStyle, textAlign: 'right' }}>
                    <EditableCell
                      value={item.non_grounding_hours}
                      format="hours"
                      onSave={(v) => handleSave(item, 'non_grounding_hours', v)}
                    />
                  </td>

                  {/* Non-Grounding Cost */}
                  <td className={CELL_CLASS} style={{ ...cellStyle, textAlign: 'right' }}>
                    <EditableCell
                      value={item.non_grounding_cost}
                      format="cost"
                      onSave={(v) => handleSave(item, 'non_grounding_cost', v)}
                    />
                  </td>

                  {/* Reference */}
                  <td
                    className={CELL_CLASS}
                    style={{
                      ...cellStyle,
                      color: 'var(--text-quaternary)',
                      fontSize: 11,
                      maxWidth: 240,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={item.reference_note ?? undefined}
                  >
                    {item.reference_note ?? '\u2014'}
                  </td>
                </motion.tr>
              ))}
            </motion.tbody>
          </table>
        </div>
      )}
    </div>
  );
}
