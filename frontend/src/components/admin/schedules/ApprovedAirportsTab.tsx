import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  MapPin,
  MagnifyingGlass,
  Plus,
  Trash,
  SpinnerGap,
  Star,
  ArrowCounterClockwise,
} from '@phosphor-icons/react';
import type { Airport } from '@acars/shared';
import { api } from '../../../lib/api';
import { toast } from '../../../stores/toastStore';
import { ConfirmDialog } from '../ConfirmDialog';

// ─── Approved Airports Tab ──────────────────────────────────────

export function ApprovedAirportsTab() {
  const [airports, setAirports] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add airport
  const [addIcao, setAddIcao] = useState('');
  const [adding, setAdding] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Airport | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Inline handler edit
  const [editingHandler, setEditingHandler] = useState<string | null>(null);
  const [handlerValue, setHandlerValue] = useState('');
  const handlerInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch airports ──────────────────────────────────────────
  const fetchAirports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ airports: Airport[]; total: number }>('/api/admin/airports');
      setAirports(res.airports);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load airports';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAirports();
  }, [fetchAirports]);

  // ── Client-side search filter ───────────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return airports;
    const q = search.toLowerCase();
    return airports.filter(
      (a) =>
        a.icao.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q)
    );
  }, [airports, search]);

  // ── Stats ───────────────────────────────────────────────────
  const hubCount = useMemo(() => airports.filter((a) => a.isHub).length, [airports]);

  // ── Add airport ─────────────────────────────────────────────
  const handleAdd = async () => {
    const icao = addIcao.trim().toUpperCase();
    if (!icao || icao.length < 3 || icao.length > 4) {
      toast.error('Enter a valid 3-4 character ICAO code');
      return;
    }
    setAdding(true);
    try {
      await api.post<Airport>('/api/admin/airports', { icao, isHub: false });
      setAddIcao('');
      toast.success(`${icao} added`);
      fetchAirports();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add airport';
      toast.error(message);
    } finally {
      setAdding(false);
    }
  };

  // ── Toggle hub ──────────────────────────────────────────────
  const handleToggleHub = async (airport: Airport) => {
    try {
      await api.patch(`/api/admin/airports/${airport.icao}/hub`);
      setAirports((prev) =>
        prev.map((a) => (a.icao === airport.icao ? { ...a, isHub: !a.isHub } : a))
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to toggle hub status';
      toast.error(message);
    }
  };

  // ── Inline handler edit ─────────────────────────────────────
  const startEditHandler = (airport: Airport) => {
    setEditingHandler(airport.icao);
    setHandlerValue(airport.handler ?? '');
    setTimeout(() => handlerInputRef.current?.focus(), 0);
  };

  const saveHandler = async (icao: string) => {
    setEditingHandler(null);
    const trimmed = handlerValue.trim();
    const airport = airports.find((a) => a.icao === icao);
    if (!airport) return;
    const current = airport.handler ?? '';
    if (trimmed === current) return;

    try {
      await api.patch(`/api/admin/airports/${icao}`, {
        handler: trimmed || null,
      });
      setAirports((prev) =>
        prev.map((a) => (a.icao === icao ? { ...a, handler: trimmed || null } : a))
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update handler';
      toast.error(message);
    }
  };

  // ── Delete airport ──────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/api/admin/airports/${deleteTarget.icao}`);
      setAirports((prev) => prev.filter((a) => a.icao !== deleteTarget.icao));
      toast.success(`${deleteTarget.icao} removed`);
      setDeleteTarget(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete airport';
      toast.error(message);
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col overflow-hidden gap-4 mt-4">
      {/* Stats bar + Add airport */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 text-[11px]">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-acars-muted">Total:</span>
            <span className="font-mono text-acars-text">{airports.length}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 text-amber-400" weight="fill" />
            <span className="text-acars-muted">Hubs:</span>
            <span className="font-mono text-amber-400">{hubCount}</span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-acars-muted pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ICAO, name, city..."
              className="input-field text-xs font-mono h-8 pl-8 w-[220px]"
            />
          </div>

          {/* Add Airport */}
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={addIcao}
              onChange={(e) => setAddIcao(e.target.value.toUpperCase().slice(0, 4))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
              placeholder="ICAO"
              className="input-field text-xs font-mono h-8 w-[72px] text-center uppercase"
            />
            <button
              onClick={handleAdd}
              disabled={adding || addIcao.trim().length < 3}
              className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-400/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {adding ? (
                <SpinnerGap className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              Add
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={() => fetchAirports()}
            className="h-8 w-8 rounded-md border border-acars-border bg-acars-bg text-acars-muted hover:text-acars-text flex items-center justify-center transition-colors"
            title="Refresh"
          >
            <ArrowCounterClockwise className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 panel flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-acars-panel">
              <tr className="text-[10px] uppercase tracking-wider text-acars-muted border-b border-acars-border">
                <th className="text-left px-4 py-2.5 font-medium">ICAO</th>
                <th className="text-left px-3 py-2.5 font-medium">Name</th>
                <th className="text-left px-3 py-2.5 font-medium">City</th>
                <th className="text-left px-3 py-2.5 font-medium">Country</th>
                <th className="text-center px-3 py-2.5 font-medium">Hub</th>
                <th className="text-left px-3 py-2.5 font-medium">Handler</th>
                <th className="text-right px-3 py-2.5 font-medium">Elevation</th>
                <th className="text-center px-3 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && airports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <SpinnerGap className="w-5 h-5 text-blue-400 animate-spin mx-auto mb-2" />
                    <span className="text-xs text-acars-muted">Loading airports...</span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <MapPin className="w-8 h-8 text-acars-muted/20 mx-auto mb-3" />
                    <span className="text-xs text-acars-muted">
                      {search ? 'No airports match your search' : 'No approved airports'}
                    </span>
                  </td>
                </tr>
              ) : (
                filtered.map((a, i) => (
                  <tr
                    key={a.icao}
                    className={`border-b border-acars-border hover:bg-white/5 transition-colors ${
                      i % 2 === 0 ? 'bg-acars-panel' : 'bg-acars-bg'
                    }`}
                  >
                    {/* ICAO */}
                    <td className="px-4 py-2.5">
                      <span className="font-mono font-semibold text-acars-text">{a.icao}</span>
                    </td>

                    {/* Name */}
                    <td className="px-3 py-2.5">
                      <span className="text-acars-muted truncate max-w-[200px] block" title={a.name}>
                        {a.name}
                      </span>
                    </td>

                    {/* City */}
                    <td className="px-3 py-2.5">
                      <span className="text-acars-muted">{a.city}</span>
                    </td>

                    {/* Country */}
                    <td className="px-3 py-2.5">
                      <span className="text-acars-muted font-mono">{a.country}</span>
                    </td>

                    {/* Hub toggle */}
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => handleToggleHub(a)}
                        className="inline-flex items-center justify-center"
                        title={a.isHub ? 'Remove hub status' : 'Set as hub'}
                      >
                        <Star
                          className={`w-4 h-4 transition-colors ${
                            a.isHub
                              ? 'text-amber-400'
                              : 'text-acars-muted hover:text-amber-400'
                          }`}
                          weight={a.isHub ? 'fill' : 'regular'}
                        />
                      </button>
                    </td>

                    {/* Handler (inline edit) */}
                    <td className="px-3 py-2.5">
                      {editingHandler === a.icao ? (
                        <input
                          ref={handlerInputRef}
                          type="text"
                          value={handlerValue}
                          onChange={(e) => setHandlerValue(e.target.value)}
                          onBlur={() => saveHandler(a.icao)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveHandler(a.icao);
                            if (e.key === 'Escape') setEditingHandler(null);
                          }}
                          className="bg-transparent border border-acars-border rounded px-2 py-1 text-xs text-acars-text focus:border-blue-500 focus:outline-none font-mono w-full max-w-[160px]"
                        />
                      ) : (
                        <button
                          onClick={() => startEditHandler(a)}
                          className="text-left font-mono text-xs hover:text-blue-400 transition-colors w-full max-w-[160px] truncate block"
                          title={a.handler ? `Click to edit: ${a.handler}` : 'Click to set handler'}
                        >
                          <span className={a.handler ? 'text-acars-text' : 'text-acars-muted/40 italic'}>
                            {a.handler || 'none'}
                          </span>
                        </button>
                      )}
                    </td>

                    {/* Elevation */}
                    <td className="px-3 py-2.5 text-right">
                      <span className="font-mono text-acars-muted tabular-nums">
                        {a.elevation.toLocaleString()} ft
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => setDeleteTarget(a)}
                        className="p-1.5 rounded-md text-acars-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove Airport"
        message={
          deleteTarget
            ? `Remove ${deleteTarget.icao} (${deleteTarget.name}) from approved airports? This will not affect existing schedules.`
            : ''
        }
        variant="danger"
        confirmLabel="Remove"
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
