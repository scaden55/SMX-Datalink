import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Search,
  MoreVertical,
  Pencil,
  Copy,
  ToggleLeft,
  Trash2,
  Plus,
  Calendar,
  Zap,
  RefreshCw,
  Building2,
  Clock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plane,
  DollarSign,
  MapPin,
  Loader2,
  X,
  Globe,
  Navigation,
} from 'lucide-react';
import {
  pageVariants,
  staggerContainer,
  staggerItem,
  fadeUp,
  tableContainer,
  tableRow,
  cardHover,
} from '@/lib/motion';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScheduleFormSheet, type ScheduleFormData } from '@/components/dialogs/ScheduleFormSheet';

// ── Types ───────────────────────────────────────────────────────

interface Schedule {
  id: number;
  flightNumber: string;
  depIcao: string;
  arrIcao: string;
  aircraftType: string;
  depTime: string;
  arrTime: string;
  distanceNm: number;
  flightTimeMin: number;
  daysOfWeek: string;
  isActive: boolean;
  flightType: string | null;
  depName?: string;
  arrName?: string;
  bidCount: number;
}

interface ScheduleListResponse {
  schedules: Schedule[];
  total: number;
  page: number;
  pageSize: number;
}

interface Airport {
  id: number;
  icao: string;
  name: string;
  city: string;
  state: string;
  country: string;
  lat: number;
  lon: number;
  elevation: number;
  timezone: string;
  isHub: boolean;
  handler: string | null;
}

interface AirportListResponse {
  airports: Airport[];
  total: number;
}

interface AirportSearchResult {
  ident: string;
  name: string;
  iata_code: string | null;
  municipality: string | null;
  iso_country: string | null;
}

interface CharterStatus {
  month: string;
  generatedAt: string | null;
  charterCount: number;
  eventCount: number;
}

interface VatsimEvent {
  id: number;
  name: string;
  eventType: string;
  startTime: string;
  endTime: string;
  airports: string[];
}

// ── Helpers ─────────────────────────────────────────────────────

function getFlightType(aircraftType: string, flightType: string | null): string {
  if (flightType === 'charter') return 'charter';
  if (aircraftType === 'Cargo') return 'cargo';
  return 'passenger';
}

function formatDaysOfWeek(days: string): string {
  if (!days) return '\u00B7 \u00B7 \u00B7 \u00B7 \u00B7 \u00B7 \u00B7';
  const dayLetters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const activeDays = days.split(',').map((d) => d.trim().toLowerCase());
  const dayMap: Record<string, number> = {
    mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6,
    monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6,
    '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6,
    m: 0, t: 1, w: 2, th: 3, f: 4, s: 5, su: 6,
  };
  const activeIndices = new Set<number>();
  activeDays.forEach((d) => {
    if (dayMap[d] !== undefined) activeIndices.add(dayMap[d]);
  });
  if (activeIndices.size === 0) return days;
  return dayLetters.map((letter, i) => activeIndices.has(i) ? letter : '\u00B7').join(' ');
}

// ── Inline Style Constants ──────────────────────────────────────

const typeBadgeStyle = (type: string): React.CSSProperties => {
  if (type === 'cargo') return {
    padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600, fontFamily: 'inherit',
    background: 'rgba(79,108,205,0.13)', color: 'var(--accent-blue-bright)',
  };
  if (type === 'charter') return {
    padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600, fontFamily: 'inherit',
    background: 'rgba(251,191,36,0.13)', color: 'var(--accent-amber)',
  };
  return {
    padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600, fontFamily: 'inherit',
    background: 'rgba(96,165,250,0.13)', color: '#60a5fa',
  };
};

const statusBadgeStyle = (active: boolean): React.CSSProperties => {
  if (active) return {
    padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600, fontFamily: 'inherit',
    background: 'rgba(74,222,128,0.13)', color: 'var(--accent-emerald)',
  };
  return {
    padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600, fontFamily: 'inherit',
    background: 'rgba(251,191,36,0.13)', color: 'var(--accent-amber)',
  };
};

// ═══════════════════════════════════════════════════════════════
// ── Airport Detail Panel ────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

function AirportDetailPanel({
  airport,
  onClose,
  onEdit,
  onToggleHub,
  onDelete,
}: {
  airport: Airport;
  onClose: () => void;
  onEdit: (a: Airport) => void;
  onToggleHub: (a: Airport) => void;
  onDelete: (a: Airport) => void;
}) {
  const sectionLabel: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    fontFamily: 'inherit',
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 380,
        background: 'var(--surface-1)',
        borderLeft: '1px solid var(--border-primary)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 30,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          background: airport.isHub ? 'rgba(74,222,128,0.13)' : 'var(--accent-blue-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          {airport.isHub ? (
            <Building2 size={18} style={{ color: 'var(--accent-emerald)' }} />
          ) : (
            <Navigation size={18} style={{ color: 'var(--accent-blue-bright)' }} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono, monospace)' }}>
            {airport.icao}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {airport.name}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-tertiary)',
            padding: 4,
            borderRadius: 4,
            display: 'flex',
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Content — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Location */}
        <div>
          <div style={sectionLabel}>Location</div>
          <div style={{
            borderRadius: 6,
            border: '1px solid var(--border-primary)',
            background: 'var(--surface-2)',
            overflow: 'hidden',
          }}>
            {[
              { label: 'City', value: airport.city || '--' },
              { label: 'State', value: airport.state || '--' },
              { label: 'Country', value: airport.country || '--' },
              { label: 'Latitude', value: airport.lat != null ? airport.lat.toFixed(4) + '°' : '--' },
              { label: 'Longitude', value: airport.lon != null ? airport.lon.toFixed(4) + '°' : '--' },
              { label: 'Elevation', value: airport.elevation != null ? `${airport.elevation.toLocaleString()} ft` : '--' },
              { label: 'Timezone', value: airport.timezone || '--' },
            ].map((row, i, arr) => (
              <div
                key={row.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--border-primary)' : 'none',
                  fontSize: 12,
                }}
              >
                <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Operations */}
        <div>
          <div style={sectionLabel}>Operations</div>
          <div style={{
            borderRadius: 6,
            border: '1px solid var(--border-primary)',
            background: 'var(--surface-2)',
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              borderBottom: '1px solid var(--border-primary)',
              fontSize: 12,
            }}>
              <span style={{ color: 'var(--text-secondary)' }}>Hub Status</span>
              {airport.isHub ? (
                <span style={{
                  padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                  background: 'rgba(74,222,128,0.13)', color: 'var(--accent-emerald)',
                }}>
                  HUB
                </span>
              ) : (
                <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>Spoke</span>
              )}
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              fontSize: 12,
            }}>
              <span style={{ color: 'var(--text-secondary)' }}>Ground Handler</span>
              <span style={{ color: airport.handler ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: 500 }}>
                {airport.handler || 'Not assigned'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid var(--border-primary)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => onEdit(airport)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid var(--border-primary)',
              background: 'var(--surface-2)',
              color: 'var(--text-primary)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <Pencil size={13} />
            Edit
          </button>
          <button
            onClick={() => onToggleHub(airport)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid var(--border-primary)',
              background: 'var(--surface-2)',
              color: airport.isHub ? 'var(--accent-amber)' : 'var(--accent-emerald)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <Building2 size={13} />
            {airport.isHub ? 'Remove Hub' : 'Set as Hub'}
          </button>
        </div>
        <button
          onClick={() => onDelete(airport)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid var(--accent-red-ring)',
            background: 'var(--accent-red-bg)',
            color: 'var(--accent-red)',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
            width: '100%',
          }}
        >
          <Trash2 size={13} />
          Delete Airport
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ── Airports Tab ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

function AirportsTab() {
  const [airports, setAirports] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedAirport, setSelectedAirport] = useState<Airport | null>(null);

  // Add airport dialog
  const [addOpen, setAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AirportSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingIcao, setAddingIcao] = useState<string | null>(null);

  // Edit airport dialog
  const [editAirport, setEditAirport] = useState<Airport | null>(null);
  const [editHandler, setEditHandler] = useState('');
  const [editHub, setEditHub] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  // Delete
  const [deleteAirport, setDeleteAirport] = useState<Airport | null>(null);
  const [deleteScheduleCount, setDeleteScheduleCount] = useState(0);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────

  const fetchAirports = useCallback(async () => {
    try {
      const res = await api.get<AirportListResponse>('/api/admin/airports');
      setAirports(res.airports);
      setError(null);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load airports';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAirports();
  }, [fetchAirports]);

  // ── Filtered list ──────────────────────────────────────────

  const filteredAirports = useMemo(() => {
    if (!search) return airports;
    const q = search.toLowerCase();
    return airports.filter(
      (a) =>
        a.icao.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q) ||
        a.country.toLowerCase().includes(q),
    );
  }, [airports, search]);

  // ── Airport Search ─────────────────────────────────────────

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await api.get<AirportSearchResult[]>(
          `/api/airports/search?q=${encodeURIComponent(searchQuery)}&limit=15`,
        );
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  async function handleAddAirport(icao: string) {
    setAddingIcao(icao);
    try {
      await api.post('/api/admin/airports', { icao });
      toast.success(`${icao} added to approved airports`);
      setSearchQuery('');
      setSearchResults([]);
      setAddOpen(false);
      fetchAirports();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : `Failed to add ${icao}`);
    } finally {
      setAddingIcao(null);
    }
  }

  // ── Actions ────────────────────────────────────────────────

  function openEditAirport(airport: Airport) {
    setEditAirport(airport);
    setEditHandler(airport.handler ?? '');
    setEditHub(airport.isHub);
  }

  async function handleSaveEdit() {
    if (!editAirport) return;
    setEditSaving(true);
    try {
      await api.patch(`/api/admin/airports/${editAirport.icao}`, {
        handler: editHandler || null,
        isHub: editHub,
      });
      toast.success(`${editAirport.icao} updated`);
      setEditAirport(null);
      fetchAirports();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update airport');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleToggleHub(airport: Airport) {
    try {
      await api.patch(`/api/admin/airports/${airport.icao}/hub`);
      toast.success(`${airport.icao} ${airport.isHub ? 'removed from hubs' : 'set as hub'}`);
      fetchAirports();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to toggle hub status');
    }
  }

  function initiateDelete(airport: Airport) {
    setDeleteAirport(airport);
    setDeleteScheduleCount(0);
  }

  async function handleDeleteAirport(force = false) {
    if (!deleteAirport) return;
    setDeleteLoading(true);
    try {
      const url = force
        ? `/api/admin/airports/${deleteAirport.icao}?force=true`
        : `/api/admin/airports/${deleteAirport.icao}`;
      await api.delete(url);
      const extra = force && deleteScheduleCount > 0
        ? ` and ${deleteScheduleCount} schedule(s)`
        : '';
      toast.success(`${deleteAirport.icao} removed${extra}`);
      setDeleteAirport(null);
      setDeleteScheduleCount(0);
      fetchAirports();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Parse schedule count from error message like "KMIA is used by 5 schedule(s)"
        const match = err.message.match(/(\d+)\s+schedule/);
        setDeleteScheduleCount(match ? parseInt(match[1]) : 1);
      } else {
        toast.error(err instanceof ApiError ? err.message : 'Failed to delete airport');
      }
    } finally {
      setDeleteLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────

  const hubCount = airports.filter((a) => a.isHub).length;

  return (
    <>
      {/* Stats Row */}
      <motion.div variants={staggerContainer} initial="hidden" animate="visible" style={{ display: 'flex', gap: 12, padding: '0 24px 12px' }}>
        {[
          { label: 'Total Airports', value: loading ? '--' : airports.length, color: 'var(--text-primary)' },
          { label: 'Hub Airports', value: loading ? '--' : hubCount, color: 'var(--accent-amber)' },
          { label: 'Countries', value: loading ? '--' : new Set(airports.map((a) => a.country)).size, color: 'var(--accent-blue-bright)' },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            variants={staggerItem}
            style={{
              flex: 1,
              borderRadius: 6,
              background: 'var(--surface-2)',
              border: '1px solid var(--border-primary)',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>{stat.label}</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: stat.color, fontFamily: 'var(--font-sans)' }}>
              {stat.value}
            </span>
          </motion.div>
        ))}
      </motion.div>

      {/* Filter Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 24px',
          borderBottom: '1px solid var(--border-primary)',
        }}
      >
        <div style={{ position: 'relative', width: 220 }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Search airports..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-glow"
            style={{
              width: '100%',
              borderRadius: 6,
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              padding: '8px 12px 8px 32px',
              fontSize: 12,
              color: 'var(--text-primary)',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setAddOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--accent-blue)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '8px 16px',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <Plus size={14} />
          Add Airport
        </button>
      </div>

      {/* Table + Detail Panel container */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden', display: 'flex' }}>
      <div style={{ padding: '0 24px', flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
            Loading airports...
          </div>
        ) : error ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
            {error}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[
                  { label: 'ICAO', width: 80 },
                  { label: 'NAME', width: undefined },
                  { label: 'CITY', width: 140 },
                  { label: 'COUNTRY', width: 80 },
                  { label: 'HUB', width: 70 },
                  { label: '', width: 40 },
                ].map((col) => (
                  <th
                    key={col.label || 'actions'}
                    style={{
                      padding: '10px 16px',
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: 0.8,
                      color: 'var(--text-tertiary)',
                      textAlign: 'left',
                      textTransform: 'uppercase',
                      borderBottom: '1px solid var(--border-primary)',
                      width: col.width,
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <motion.tbody variants={tableContainer} initial="hidden" animate="visible">
              {filteredAirports.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
                    No airports found
                  </td>
                </tr>
              ) : (
                filteredAirports.map((airport) => {
                  const isSelected = selectedAirport?.id === airport.id;
                  return (
                  <motion.tr
                    key={airport.id}
                    variants={tableRow}
                    onClick={() => setSelectedAirport(isSelected ? null : airport)}
                    style={{
                      borderBottom: '1px solid var(--border-primary)',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(79,108,205,0.08)' : undefined,
                      transition: 'background 0.15s ease',
                    }}
                    className="row-interactive"
                  >
                    <td style={{ padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono, monospace)' }}>
                      {airport.icao}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 11, color: 'var(--text-secondary)' }}>
                      {airport.name}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {airport.city}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono, monospace)' }}>
                      {airport.country}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      {airport.isHub ? (
                        <span style={{
                          padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                          background: 'rgba(74,222,128,0.13)', color: 'var(--accent-emerald)',
                        }}>
                          HUB
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>--</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--text-tertiary)',
                              padding: 4,
                              borderRadius: 4,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <MoreVertical size={14} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditAirport(airport)}>
                            <Pencil size={14} />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleHub(airport)}>
                            <Building2 size={14} />
                            {airport.isHub ? 'Remove Hub' : 'Set as Hub'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-[var(--accent-red)] focus:text-[var(--accent-red)]"
                            onClick={() => initiateDelete(airport)}
                          >
                            <Trash2 size={14} />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </motion.tr>
                  );
                })
              )}
            </motion.tbody>
          </table>
        )}
      </div>

      {/* Airport Detail Panel */}
      {selectedAirport && (
        <AirportDetailPanel
          airport={selectedAirport}
          onClose={() => setSelectedAirport(null)}
          onEdit={(a) => { openEditAirport(a); setSelectedAirport(null); }}
          onToggleHub={(a) => { handleToggleHub(a); setSelectedAirport(null); }}
          onDelete={(a) => { initiateDelete(a); setSelectedAirport(null); }}
        />
      )}
      </div>

      {/* Add Airport Dialog */}
      <Dialog open={addOpen} onOpenChange={(open) => { if (!open) { setAddOpen(false); setSearchQuery(''); setSearchResults([]); } else { setAddOpen(true); } }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Airport</DialogTitle>
            <DialogDescription>
              Search by ICAO code or airport name to add it to your approved stations.
            </DialogDescription>
          </DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ position: 'relative' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-tertiary)',
                  pointerEvents: 'none',
                }}
              />
              <Input
                placeholder="Search ICAO or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto', borderRadius: 6, border: '1px solid var(--border-primary)' }}>
              {searching && (
                <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>Searching...</div>
              )}
              {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>No airports found</div>
              )}
              {!searching && searchQuery.length < 2 && (
                <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>Type at least 2 characters</div>
              )}
              {searchResults.map((result) => {
                const alreadyAdded = airports.some((a) => a.icao === result.ident);
                return (
                  <div
                    key={result.ident}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 16px',
                      borderBottom: '1px solid var(--border-primary)',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}>{result.ident}</span>
                        {result.iata_code && (
                          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>({result.iata_code})</span>
                        )}
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                        {result.name}
                        {result.municipality && `, ${result.municipality}`}
                        {result.iso_country && ` (${result.iso_country})`}
                      </p>
                    </div>
                    {alreadyAdded ? (
                      <span style={{
                        marginLeft: 8,
                        padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                        background: 'rgba(74,222,128,0.13)', color: 'var(--accent-emerald)',
                      }}>
                        ADDED
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        style={{ marginLeft: 8, flexShrink: 0 }}
                        onClick={() => handleAddAirport(result.ident)}
                        disabled={addingIcao === result.ident}
                      >
                        {addingIcao === result.ident ? 'Adding...' : 'Add'}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Airport Dialog */}
      <Dialog open={!!editAirport} onOpenChange={(open) => { if (!open) setEditAirport(null); }}>
        <DialogContent className="sm:max-w-[440px]" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Airport header card */}
          <div style={{
            background: 'var(--surface-2)',
            borderBottom: '1px solid var(--border-primary)',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              background: 'var(--accent-blue-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--accent-blue-bright)',
                fontFamily: 'var(--font-mono, monospace)',
                letterSpacing: -0.5,
              }}>
                {editAirport?.icao}
              </span>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                {editAirport?.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {editAirport?.city}{editAirport?.country && `, ${editAirport.country}`}
              </div>
            </div>
          </div>

          {/* Form fields */}
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Ground Handler
              </label>
              <Input
                placeholder="e.g. Swissport, Menzies, etc."
                value={editHandler}
                onChange={(e) => setEditHandler(e.target.value)}
              />
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: 6,
              border: '1px solid var(--border-primary)',
              background: 'var(--surface-1)',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Hub Airport</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>Designate as a primary hub station</div>
              </div>
              <button
                onClick={() => setEditHub(!editHub)}
                style={{
                  width: 40,
                  height: 22,
                  borderRadius: 11,
                  border: 'none',
                  cursor: 'pointer',
                  position: 'relative',
                  background: editHub ? 'var(--accent-emerald)' : 'var(--surface-3)',
                  transition: 'background 0.2s ease',
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: editHub ? 20 : 2,
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    background: '#fff',
                    transition: 'left 0.2s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }}
                />
              </button>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            borderTop: '1px solid var(--border-primary)',
            padding: '14px 24px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}>
            <Button variant="outline" onClick={() => setEditAirport(null)} disabled={editSaving}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={editSaving}>
              {editSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Airport Dialog */}
      <Dialog open={!!deleteAirport} onOpenChange={(open) => { if (!open) { setDeleteAirport(null); setDeleteScheduleCount(0); } }}>
        <DialogContent className="sm:max-w-[440px]" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Airport header card */}
          <div style={{
            background: deleteScheduleCount > 0 ? 'var(--accent-red-bg)' : 'var(--surface-2)',
            borderBottom: deleteScheduleCount > 0 ? '1px solid var(--accent-red-ring)' : '1px solid var(--border-primary)',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              background: deleteScheduleCount > 0 ? 'var(--accent-red-bg)' : 'var(--accent-blue-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{
                fontSize: 14,
                fontWeight: 700,
                color: deleteScheduleCount > 0 ? 'var(--accent-red)' : 'var(--accent-blue-bright)',
                fontFamily: 'var(--font-mono, monospace)',
                letterSpacing: -0.5,
              }}>
                {deleteAirport?.icao}
              </span>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                Delete {deleteAirport?.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {deleteAirport?.city}{deleteAirport?.country && `, ${deleteAirport.country}`}
              </div>
            </div>
          </div>

          {/* Content */}
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {deleteScheduleCount > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '12px 14px',
                borderRadius: 6,
                background: 'var(--accent-red-bg)',
                border: '1px solid var(--accent-red-ring)',
              }}>
                <Trash2 size={16} style={{ color: 'var(--accent-red)', flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-red)', lineHeight: 1.3 }}>
                    {deleteScheduleCount} schedule{deleteScheduleCount !== 1 ? 's' : ''} will be deleted
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, lineHeight: 1.5 }}>
                    All schedules that depart from or arrive at this airport will be permanently removed along with any active bids.
                  </div>
                </div>
              </div>
            )}

            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {deleteScheduleCount > 0 ? (
                <>This action cannot be undone. The airport, its lane rates, and all associated schedules will be permanently deleted.</>
              ) : (
                <>Are you sure you want to remove this airport? Any associated lane rates will also be deleted. This action cannot be undone.</>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{
            borderTop: '1px solid var(--border-primary)',
            padding: '14px 24px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}>
            <Button
              variant="outline"
              onClick={() => { setDeleteAirport(null); setDeleteScheduleCount(0); }}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDeleteAirport(deleteScheduleCount > 0)}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Deleting...' : deleteScheduleCount > 0 ? `Delete Airport & ${deleteScheduleCount} Schedule${deleteScheduleCount !== 1 ? 's' : ''}` : 'Delete Airport'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// ── Charters Tab ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

function ChartersTab() {
  const [charterStatus, setCharterStatus] = useState<CharterStatus | null>(null);
  const [events, setEvents] = useState<VatsimEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, eventsRes] = await Promise.all([
        api.get<CharterStatus>('/api/admin/charters/status'),
        api.get<{ events: VatsimEvent[]; total: number }>('/api/admin/events'),
      ]);
      setCharterStatus(statusRes);
      setEvents(eventsRes.events);
    } catch {
      // Charter system might not be initialized yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const result = await api.post<{ charterCount: number; eventCount: number }>('/api/admin/charters/generate');
      toast.success(`Generated ${result.charterCount} charter(s) from ${result.eventCount} event(s)`);
      fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to generate charters');
    } finally {
      setGenerating(false);
    }
  }

  async function handleRefreshEvents() {
    setRefreshing(true);
    try {
      const result = await api.post<{ eventsCached: number; chartersCreated: number }>('/api/admin/events/refresh');
      toast.success(`Refreshed: ${result.eventsCached} events cached, ${result.chartersCreated} charters created`);
      fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to refresh events');
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <>
      {/* Stats Row */}
      <motion.div variants={staggerContainer} initial="hidden" animate="visible" style={{ display: 'flex', gap: 12, padding: '0 24px 12px' }}>
        {[
          { label: 'Current Month', value: loading ? '--' : (charterStatus?.month ?? '--'), color: 'var(--text-primary)' },
          { label: 'Generated Charters', value: loading ? '--' : (charterStatus?.charterCount ?? 0), color: 'var(--accent-emerald)' },
          { label: 'VATSIM Events', value: loading ? '--' : events.length, color: 'var(--accent-amber)' },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            variants={staggerItem}
            style={{
              flex: 1,
              borderRadius: 6,
              background: 'var(--surface-2)',
              border: '1px solid var(--border-primary)',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>{stat.label}</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: stat.color, fontFamily: 'var(--font-sans)' }}>
              {stat.value}
            </span>
          </motion.div>
        ))}
      </motion.div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, padding: '0 24px 12px', alignItems: 'center' }}>
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--accent-blue)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '8px 16px',
            fontSize: 12,
            fontWeight: 600,
            cursor: generating ? 'default' : 'pointer',
            opacity: generating ? 0.7 : 1,
            fontFamily: 'inherit',
          }}
        >
          {generating ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
          {generating ? 'Generating...' : 'Generate Monthly Charters'}
        </button>
        <button
          onClick={handleRefreshEvents}
          disabled={refreshing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-primary)',
            borderRadius: 6,
            padding: '8px 16px',
            fontSize: 12,
            fontWeight: 600,
            cursor: refreshing ? 'default' : 'pointer',
            opacity: refreshing ? 0.7 : 1,
            fontFamily: 'inherit',
          }}
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing...' : 'Refresh VATSIM Events'}
        </button>
        {charterStatus?.generatedAt && (
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 8 }}>
            Last generated: {new Date(charterStatus.generatedAt).toLocaleString()}
          </span>
        )}
      </div>

      {/* Events Table */}
      <div style={{ padding: '0 24px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.8, padding: '12px 0 8px', borderBottom: '1px solid var(--border-primary)' }}>
          Active VATSIM Events ({events.length})
        </div>
        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
            Loading charters...
          </div>
        ) : events.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <Clock size={32} style={{ margin: '0 auto 8px', opacity: 0.5, display: 'block' }} />
            <p style={{ fontSize: 12, margin: 0 }}>No active VATSIM events at this time.</p>
            <p style={{ fontSize: 10, color: 'var(--text-tertiary)', margin: '4px 0 0', opacity: 0.7 }}>Events are polled automatically from the VATSIM API.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[
                  { label: 'EVENT NAME', width: undefined },
                  { label: 'TYPE', width: 100 },
                  { label: 'START', width: 160 },
                  { label: 'END', width: 160 },
                  { label: 'AIRPORTS', width: 120 },
                ].map((col) => (
                  <th
                    key={col.label}
                    style={{
                      padding: '10px 16px',
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: 0.8,
                      color: 'var(--text-tertiary)',
                      textAlign: 'left',
                      textTransform: 'uppercase',
                      borderBottom: '1px solid var(--border-primary)',
                      width: col.width,
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <motion.tbody variants={tableContainer} initial="hidden" animate="visible">
              {events.map((event) => (
                <motion.tr key={event.id} variants={tableRow} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                  <td style={{ padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {event.name}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                      background: 'rgba(79,108,205,0.13)', color: 'var(--accent-blue-bright)',
                    }}>
                      {event.eventType.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono, monospace)' }}>
                    {new Date(event.startTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono, monospace)' }}>
                    {new Date(event.endTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {event.airports.slice(0, 3).map((icao) => (
                        <span
                          key={icao}
                          style={{
                            padding: '1px 6px',
                            borderRadius: 3,
                            fontSize: 10,
                            fontWeight: 600,
                            fontFamily: 'var(--font-mono, monospace)',
                            background: 'var(--surface-2)',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-primary)',
                          }}
                        >
                          {icao}
                        </span>
                      ))}
                      {event.airports.length > 3 && (
                        <span
                          style={{
                            padding: '1px 6px',
                            borderRadius: 3,
                            fontSize: 10,
                            fontWeight: 600,
                            background: 'var(--surface-2)',
                            color: 'var(--text-tertiary)',
                            border: '1px solid var(--border-primary)',
                          }}
                        >
                          +{event.airports.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </motion.tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// ── Route Detail Panel ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

interface RevenueEstimate {
  cargoLbs: number;
  distanceNm: number;
  distanceFactor: number;
  aircraftClass: string;
  manifest: { standardLbs: number; nonstandardLbs: number; hazardLbs: number };
  revenue: { standard: number; nonstandard: number; hazard: number; total: number };
  pilotPay: number;
  blockHours: number;
}

function RouteDetailPanel({
  schedule,
  onClose,
  onEdit,
  onClone,
  onToggle,
  onDelete,
}: {
  schedule: Schedule;
  onClose: () => void;
  onEdit: (s: Schedule) => void;
  onClone: (s: Schedule) => void;
  onToggle: (s: Schedule) => void;
  onDelete: (s: Schedule) => void;
}) {
  const [estimate, setEstimate] = useState<RevenueEstimate | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);

  useEffect(() => {
    if (schedule.distanceNm > 0 && schedule.flightTimeMin > 0) {
      setEstimateLoading(true);
      api
        .get<RevenueEstimate>(
          `/api/admin/schedules/estimate?distanceNm=${schedule.distanceNm}&flightTimeMin=${schedule.flightTimeMin}`,
        )
        .then(setEstimate)
        .catch(() => setEstimate(null))
        .finally(() => setEstimateLoading(false));
    }
  }, [schedule.distanceNm, schedule.flightTimeMin]);

  const fType = getFlightType(schedule.aircraftType, schedule.flightType);
  const flightHours = schedule.flightTimeMin > 0 ? Math.floor(schedule.flightTimeMin / 60) : 0;
  const flightMins = schedule.flightTimeMin > 0 ? schedule.flightTimeMin % 60 : 0;

  const sectionLabel: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    fontFamily: 'inherit',
  };

  const metricRow: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 0',
    borderBottom: '1px solid var(--border-primary)',
    fontSize: 12,
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 380,
        background: 'var(--surface-1)',
        borderLeft: '1px solid var(--border-primary)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 30,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          background: 'var(--accent-blue-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Plane size={18} style={{ color: 'var(--accent-blue-bright)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
            {schedule.flightNumber}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: 'var(--accent-blue-bright)', fontWeight: 500 }}>{schedule.depIcao}</span>
            <span style={{ color: 'var(--text-tertiary)' }}>{'\u2192'}</span>
            <span style={{ color: 'var(--accent-blue-bright)', fontWeight: 500 }}>{schedule.arrIcao}</span>
            <span style={{ margin: '0 4px', color: 'var(--text-quaternary)' }}>{'\u00B7'}</span>
            <span style={typeBadgeStyle(fType)}>{fType.toUpperCase()}</span>
            <span style={statusBadgeStyle(schedule.isActive)}>
              {schedule.isActive ? 'ACTIVE' : 'INACTIVE'}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-tertiary)',
            padding: 4,
            borderRadius: 4,
            display: 'flex',
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Content — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Route Info */}
        <div>
          <div style={sectionLabel}>Route Details</div>
          <div style={{
            borderRadius: 6,
            border: '1px solid var(--border-primary)',
            background: 'var(--surface-2)',
            overflow: 'hidden',
          }}>
            {[
              { label: 'Distance', value: schedule.distanceNm > 0 ? `${schedule.distanceNm.toLocaleString()} nm` : '--' },
              { label: 'Flight Time', value: schedule.flightTimeMin > 0 ? `${flightHours}h ${flightMins}m` : '--' },
              { label: 'Departure', value: schedule.depTime ? `${schedule.depTime}z` : '--' },
              { label: 'Arrival', value: schedule.arrTime ? `${schedule.arrTime}z` : '--' },
              { label: 'Days', value: formatDaysOfWeek(schedule.daysOfWeek) },
              { label: 'Active Bids', value: String(schedule.bidCount ?? 0) },
            ].map((row, i, arr) => (
              <div
                key={row.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--border-primary)' : 'none',
                  fontSize: 12,
                }}
              >
                <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue Estimate */}
        <div>
          <div style={sectionLabel}>
            <DollarSign size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
            Estimated Revenue (per flight)
          </div>
          {estimateLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
              <Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-tertiary)' }} />
            </div>
          ) : estimate ? (
            <div style={{
              borderRadius: 6,
              border: '1px solid var(--border-primary)',
              background: 'var(--surface-2)',
              overflow: 'hidden',
            }}>
              {/* Total revenue highlight */}
              <div style={{
                padding: '12px',
                borderBottom: '1px solid var(--border-primary)',
                background: 'var(--accent-blue-bg)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-blue-bright)' }}>Total Revenue</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-blue-bright)', fontFamily: 'var(--font-sans)' }}>
                  ${estimate.revenue.total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
              {[
                { label: 'Standard Cargo', value: `$${estimate.revenue.standard.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
                { label: 'Non-Standard', value: `$${estimate.revenue.nonstandard.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
                { label: 'Hazard', value: `$${estimate.revenue.hazard.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
                { label: 'Pilot Pay', value: `$${estimate.pilotPay.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
                { label: 'Net (Rev - Pay)', value: `$${(estimate.revenue.total - estimate.pilotPay).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, highlight: true },
              ].map((row, i, arr) => (
                <div
                  key={row.label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderBottom: i < arr.length - 1 ? '1px solid var(--border-primary)' : 'none',
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                  <span style={{
                    color: row.highlight ? 'var(--accent-emerald)' : 'var(--text-primary)',
                    fontWeight: row.highlight ? 600 : 500,
                    fontFamily: 'var(--font-sans)',
                  }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              padding: '16px 12px',
              borderRadius: 6,
              border: '1px solid var(--border-primary)',
              background: 'var(--surface-2)',
              fontSize: 11,
              color: 'var(--text-tertiary)',
              textAlign: 'center',
            }}>
              {schedule.distanceNm > 0 ? 'Unable to estimate' : 'Distance required for estimate'}
            </div>
          )}

          {estimate && (
            <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
              Based on {Math.round(estimate.cargoLbs).toLocaleString()} lbs avg fleet capacity, Class {estimate.aircraftClass}, distance factor {estimate.distanceFactor.toFixed(2)}x
            </div>
          )}
        </div>

        {/* Cargo Manifest Breakdown */}
        {estimate && (
          <div>
            <div style={sectionLabel}>Manifest Breakdown</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { label: 'STD', lbs: estimate.manifest.standardLbs, color: 'var(--accent-blue)' },
                { label: 'NSTD', lbs: estimate.manifest.nonstandardLbs, color: 'var(--accent-amber)' },
                { label: 'HAZ', lbs: estimate.manifest.hazardLbs, color: 'var(--accent-red)' },
              ].map((seg) => {
                const pct = estimate.cargoLbs > 0 ? (seg.lbs / estimate.cargoLbs) * 100 : 0;
                return (
                  <div key={seg.label} style={{
                    flex: Math.max(pct, 5),
                    borderRadius: 4,
                    padding: '8px 6px',
                    background: `color-mix(in srgb, ${seg.color} 15%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${seg.color} 25%, transparent)`,
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: seg.color }}>{seg.label}</div>
                    <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', marginTop: 2 }}>
                      {Math.round(pct)}%
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 1 }}>
                      {Math.round(seg.lbs).toLocaleString()} lbs
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{
        padding: '12px 20px',
        borderTop: '1px solid var(--border-primary)',
        display: 'flex',
        gap: 8,
      }}>
        <button
          onClick={() => onEdit(schedule)}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            background: 'var(--accent-blue)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '8px 12px',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <Pencil size={13} />
          Edit
        </button>
        <button
          onClick={() => onClone(schedule)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-primary)',
            borderRadius: 6,
            padding: '8px 12px',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <Copy size={13} />
          Clone
        </button>
        <button
          onClick={() => onToggle(schedule)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-primary)',
            borderRadius: 6,
            padding: '8px 12px',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <ToggleLeft size={13} />
          {schedule.isActive ? 'Deactivate' : 'Activate'}
        </button>
        <button
          onClick={() => onDelete(schedule)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            color: 'var(--accent-red)',
            border: '1px solid var(--accent-red-ring)',
            borderRadius: 6,
            padding: '8px 12px',
            fontSize: 12,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ── Main Page ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

export function SchedulesPage() {
  const [activeTab, setActiveTab] = useState<'flights' | 'airports' | 'charters'>('flights');

  const tabs = [
    { id: 'flights' as const, label: 'Flights' },
    { id: 'airports' as const, label: 'Airports' },
    { id: 'charters' as const, label: 'Charters' },
  ];

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      {/* Page Header */}
      <motion.div variants={fadeUp} style={{ padding: '16px 24px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Title Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Calendar size={20} style={{ color: 'var(--accent-blue)' }} />
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Schedules</span>
          <div style={{ flex: 1 }} />
          {activeTab === 'flights' && (
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('schedules:create'));
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--accent-blue)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <Plus size={14} />
              Add Schedule
            </button>
          )}
        </div>

        {/* Tabs Row */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-primary)', gap: 0 }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: activeTab === tab.id ? 600 : 400,
                color: activeTab === tab.id ? 'var(--accent-blue-bright)' : 'var(--text-tertiary)',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--accent-blue)' : '2px solid transparent',
                cursor: 'pointer',
                fontFamily: 'inherit',
                marginBottom: -1,
                transition: 'color 0.2s ease, border-color 0.2s ease, font-weight 0.2s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Tab content area */}
      <div style={{ paddingTop: 16, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {activeTab === 'flights' && <FlightsTabWithHeaderButton />}
        {activeTab === 'airports' && <AirportsTab />}
        {activeTab === 'charters' && <ChartersTab />}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ── Flights Tab ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

function FlightsTabWithHeaderButton() {
  const [triggerCreate, setTriggerCreate] = useState(0);

  useEffect(() => {
    function handler() {
      setTriggerCreate((c) => c + 1);
    }
    window.addEventListener('schedules:create', handler);
    return () => window.removeEventListener('schedules:create', handler);
  }, []);

  return <FlightsTabInner triggerCreate={triggerCreate} />;
}

function FlightsTabInner({ triggerCreate }: { triggerCreate: number }) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('active');

  // Sheet / Dialogs
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editSchedule, setEditSchedule] = useState<ScheduleFormData | null>(null);
  const [isClone, setIsClone] = useState(false);
  const [deleteSchedule, setDeleteSchedule] = useState<Schedule | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [cloneDialogSchedule, setCloneDialogSchedule] = useState<Schedule | null>(null);
  const [cloneFlightNumber, setCloneFlightNumber] = useState('');
  const [cloneLoading, setCloneLoading] = useState(false);

  // Selected schedule for detail panel
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);

  // Dropdown open state for custom selects
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  // Handle external create trigger
  useEffect(() => {
    if (triggerCreate > 0) {
      setEditSchedule(null);
      setIsClone(false);
      setSheetOpen(true);
    }
  }, [triggerCreate]);

  // ── Fetch ──────────────────────────────────────────────────

  const fetchSchedules = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('pageSize', '100');
      if (search) params.set('search', search);
      if (typeFilter !== 'all') params.set('flightType', typeFilter === 'charter' ? 'charter' : '');
      if (activeFilter !== 'all') params.set('isActive', activeFilter === 'active' ? 'true' : 'false');

      const res = await api.get<ScheduleListResponse>(`/api/admin/schedules?${params}`);
      setSchedules(res.schedules);
      setTotalCount(res.total);
      setError(null);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load schedules';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, activeFilter]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchSchedules();
    }, search ? 300 : 0);
    return () => clearTimeout(timeout);
  }, [fetchSchedules]);

  // ── Filtered list ──

  const filteredSchedules = useMemo(() => {
    if (typeFilter === 'all' || typeFilter === 'charter') return schedules;
    return schedules.filter((s) => {
      if (typeFilter === 'cargo') return s.aircraftType === 'Cargo';
      if (typeFilter === 'passenger') return s.aircraftType === 'Passenger';
      return true;
    });
  }, [schedules, typeFilter]);

  // ── Paginated list ──

  const paginatedSchedules = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSchedules.slice(start, start + pageSize);
  }, [filteredSchedules, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredSchedules.length / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [search, typeFilter, activeFilter]);

  // ── Stats ──

  const stats = useMemo(() => {
    const total = totalCount;
    const active = schedules.filter((s) => s.isActive).length;
    const cargo = schedules.filter((s) => s.aircraftType === 'Cargo').length;
    const pax = schedules.filter((s) => s.aircraftType === 'Passenger').length;
    return { total, active, cargo, pax };
  }, [schedules, totalCount]);

  // ── Actions ──

  function handleEdit(schedule: Schedule) {
    setEditSchedule(scheduleToFormData(schedule));
    setIsClone(false);
    setSheetOpen(true);
  }

  function handleClone(schedule: Schedule) {
    setCloneDialogSchedule(schedule);
    setCloneFlightNumber('');
  }

  async function handleCloneSubmit() {
    if (!cloneDialogSchedule || !cloneFlightNumber.trim()) {
      toast.error('Flight number is required');
      return;
    }
    setCloneLoading(true);
    try {
      await api.post(`/api/admin/schedules/${cloneDialogSchedule.id}/clone`, {
        flightNumber: cloneFlightNumber.toUpperCase(),
      });
      toast.success(`Cloned as ${cloneFlightNumber.toUpperCase()}`);
      setCloneDialogSchedule(null);
      fetchSchedules();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to clone schedule');
    } finally {
      setCloneLoading(false);
    }
  }

  async function handleToggle(schedule: Schedule) {
    try {
      await api.post(`/api/admin/schedules/${schedule.id}/toggle`);
      toast.success(`${schedule.flightNumber} ${schedule.isActive ? 'deactivated' : 'activated'}`);
      fetchSchedules();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to toggle schedule');
    }
  }

  async function handleDelete() {
    if (!deleteSchedule) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/api/admin/schedules/${deleteSchedule.id}`);
      toast.success(`${deleteSchedule.flightNumber} deleted`);
      setDeleteSchedule(null);
      fetchSchedules();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete schedule');
    } finally {
      setDeleteLoading(false);
    }
  }

  function scheduleToFormData(s: Schedule): ScheduleFormData {
    return {
      id: s.id,
      flightNumber: s.flightNumber,
      depIcao: s.depIcao,
      arrIcao: s.arrIcao,
      aircraftType: s.aircraftType,
      depTime: s.depTime,
      arrTime: s.arrTime,
      distanceNm: s.distanceNm,
      flightTimeMin: s.flightTimeMin,
      daysOfWeek: s.daysOfWeek,
      isActive: s.isActive,
    };
  }

  const typeLabel = typeFilter === 'all' ? 'Type: All' : `Type: ${typeFilter.charAt(0).toUpperCase() + typeFilter.slice(1)}`;
  const statusLabel = activeFilter === 'all' ? 'Status: All' : `Status: ${activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)}`;

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: 'var(--text-tertiary)' }}>
        <p>{error}</p>
      </div>
    );
  }

  const startIdx = (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, filteredSchedules.length);

  return (
    <>
      {/* Stats Row */}
      <motion.div variants={staggerContainer} initial="hidden" animate="visible" style={{ display: 'flex', gap: 12, padding: '0 24px 12px' }}>
        {[
          { label: 'Total Schedules', value: stats.total, color: 'var(--text-primary)' },
          { label: 'Active', value: stats.active, color: 'var(--accent-emerald)' },
          { label: 'Cargo Routes', value: stats.cargo, color: 'var(--accent-blue-bright)' },
          { label: 'Passenger', value: stats.pax, color: '#60a5fa' },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            variants={staggerItem}
            style={{
              flex: 1,
              borderRadius: 6,
              background: 'var(--surface-2)',
              border: '1px solid var(--border-primary)',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>{stat.label}</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: stat.color, fontFamily: 'var(--font-sans)' }}>
              {loading ? '--' : stat.value}
            </span>
          </motion.div>
        ))}
      </motion.div>

      {/* Filter Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 24px',
          borderBottom: '1px solid var(--border-primary)',
        }}
      >
        <div style={{ position: 'relative', width: 220 }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Search flights..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-glow"
            style={{
              width: '100%',
              borderRadius: 6,
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              padding: '8px 12px 8px 32px',
              fontSize: 12,
              color: 'var(--text-primary)',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Type Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => { setTypeDropdownOpen(!typeDropdownOpen); setStatusDropdownOpen(false); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              borderRadius: 6,
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              padding: '8px 12px',
              fontSize: 12,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            {typeLabel}
            <ChevronDown size={12} style={{ color: 'var(--text-tertiary)' }} />
          </button>
          {typeDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: 4,
                background: 'var(--input-bg)',
                border: '1px solid var(--input-border)',
                borderRadius: 6,
                overflow: 'hidden',
                zIndex: 50,
                minWidth: 140,
              }}
            >
              {['all', 'cargo', 'passenger', 'charter'].map((val) => (
                <button
                  key={val}
                  onClick={() => { setTypeFilter(val); setTypeDropdownOpen(false); }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    fontSize: 12,
                    color: typeFilter === val ? 'var(--text-primary)' : 'var(--text-secondary)',
                    background: typeFilter === val ? 'rgba(79,108,205,0.13)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {val === 'all' ? 'All Types' : val.charAt(0).toUpperCase() + val.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => { setStatusDropdownOpen(!statusDropdownOpen); setTypeDropdownOpen(false); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              borderRadius: 6,
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              padding: '8px 12px',
              fontSize: 12,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            {statusLabel}
            <ChevronDown size={12} style={{ color: 'var(--text-tertiary)' }} />
          </button>
          {statusDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: 4,
                background: 'var(--input-bg)',
                border: '1px solid var(--input-border)',
                borderRadius: 6,
                overflow: 'hidden',
                zIndex: 50,
                minWidth: 140,
              }}
            >
              {['all', 'active', 'inactive'].map((val) => (
                <button
                  key={val}
                  onClick={() => { setActiveFilter(val); setStatusDropdownOpen(false); }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    fontSize: 12,
                    color: activeFilter === val ? 'var(--text-primary)' : 'var(--text-secondary)',
                    background: activeFilter === val ? 'rgba(79,108,205,0.13)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {val === 'all' ? 'All Status' : val.charAt(0).toUpperCase() + val.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Close dropdowns overlay */}
      {(typeDropdownOpen || statusDropdownOpen) && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 40 }}
          onClick={() => { setTypeDropdownOpen(false); setStatusDropdownOpen(false); }}
        />
      )}

      {/* Table + Detail Panel container */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden', display: 'flex' }}>
      <div style={{ padding: '0 24px', flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {[
                { label: 'FLIGHT', width: 70 },
                { label: 'ROUTE', width: 130 },
                { label: 'AIRCRAFT', width: 90 },
                { label: 'DEP', width: 70 },
                { label: 'ARR', width: 70 },
                { label: 'DAYS', width: 100 },
                { label: 'TYPE', width: 70 },
                { label: 'STATUS', width: undefined },
                { label: '', width: 40 },
              ].map((col) => (
                <th
                  key={col.label || 'actions'}
                  style={{
                    padding: '10px 16px',
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: 0.8,
                    color: 'var(--text-tertiary)',
                    textAlign: 'left',
                    textTransform: 'uppercase',
                    borderBottom: '1px solid var(--border-primary)',
                    width: col.width,
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <motion.tbody variants={tableContainer} initial="hidden" animate="visible">
            {loading ? (
              <tr>
                <td colSpan={9} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
                  Loading schedules...
                </td>
              </tr>
            ) : paginatedSchedules.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
                  No schedules found
                </td>
              </tr>
            ) : (
              paginatedSchedules.map((schedule) => {
                const fType = getFlightType(schedule.aircraftType, schedule.flightType);
                const isSelected = selectedSchedule?.id === schedule.id;
                return (
                  <motion.tr
                    key={schedule.id}
                    variants={tableRow}
                    onClick={() => setSelectedSchedule(isSelected ? null : schedule)}
                    style={{
                      borderBottom: '1px solid var(--border-primary)',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(79,108,205,0.08)' : undefined,
                      transition: 'background 0.15s ease',
                    }}
                    className="row-interactive"
                  >
                    <td style={{ padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {schedule.flightNumber}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 11 }}>
                      <span style={{ color: 'var(--accent-blue-bright)', fontWeight: 500 }}>{schedule.depIcao}</span>
                      <span style={{ color: 'var(--text-tertiary)', margin: '0 4px' }}>{'\u2192'}</span>
                      <span style={{ color: 'var(--accent-blue-bright)', fontWeight: 500 }}>{schedule.arrIcao}</span>
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 11, color: 'var(--text-secondary)' }}>
                      {schedule.aircraftType}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 11, color: 'var(--text-secondary)' }}>
                      {schedule.depTime}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 11, color: 'var(--text-secondary)' }}>
                      {schedule.arrTime}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
                      {formatDaysOfWeek(schedule.daysOfWeek)}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={typeBadgeStyle(fType)}>{fType.toUpperCase()}</span>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={statusBadgeStyle(schedule.isActive)}>
                        {schedule.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--text-tertiary)',
                              padding: 4,
                              borderRadius: 4,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <MoreVertical size={14} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(schedule)}>
                            <Pencil size={14} /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleClone(schedule)}>
                            <Copy size={14} /> Clone
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleToggle(schedule)}>
                            <ToggleLeft size={14} /> {schedule.isActive ? 'Deactivate' : 'Activate'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-[var(--accent-red)] focus:text-[var(--accent-red)]" onClick={() => setDeleteSchedule(schedule)}>
                            <Trash2 size={14} /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </motion.tr>
                );
              })
            )}
          </motion.tbody>
        </table>
      </div>

      {/* Route Detail Panel */}
      {selectedSchedule && (
        <RouteDetailPanel
          schedule={selectedSchedule}
          onClose={() => setSelectedSchedule(null)}
          onEdit={(s) => { handleEdit(s); setSelectedSchedule(null); }}
          onClone={(s) => { handleClone(s); setSelectedSchedule(null); }}
          onToggle={(s) => { handleToggle(s); setSelectedSchedule(null); }}
          onDelete={(s) => { setDeleteSchedule(s); setSelectedSchedule(null); }}
        />
      )}
      </div>

      {/* Pagination */}
      {!loading && filteredSchedules.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 24px',
            borderTop: '1px solid var(--border-primary)',
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            Showing {startIdx}-{endIdx} of {filteredSchedules.length} schedules
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: 4,
                border: '1px solid var(--border-primary)',
                background: 'transparent',
                color: currentPage === 1 ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                cursor: currentPage === 1 ? 'default' : 'pointer',
                opacity: currentPage === 1 ? 0.5 : 1,
              }}
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 4,
                    border: pageNum === currentPage ? '1px solid var(--accent-blue)' : '1px solid var(--border-primary)',
                    background: pageNum === currentPage ? 'rgba(79,108,205,0.13)' : 'transparent',
                    color: pageNum === currentPage ? 'var(--accent-blue-bright)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: pageNum === currentPage ? 600 : 400,
                    fontFamily: 'inherit',
                  }}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: 4,
                border: '1px solid var(--border-primary)',
                background: 'transparent',
                color: currentPage === totalPages ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                cursor: currentPage === totalPages ? 'default' : 'pointer',
                opacity: currentPage === totalPages ? 0.5 : 1,
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Schedule Form Sheet */}
      <ScheduleFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSaved={fetchSchedules}
        schedule={editSchedule}
        isClone={isClone}
      />

      {/* Clone Dialog */}
      <Dialog open={!!cloneDialogSchedule} onOpenChange={(open) => { if (!open) setCloneDialogSchedule(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Clone Schedule</DialogTitle>
            <DialogDescription>
              Create a copy of{' '}
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono, monospace)' }}>
                {cloneDialogSchedule?.flightNumber}
              </span>{' '}
              ({cloneDialogSchedule?.depIcao} - {cloneDialogSchedule?.arrIcao}).
              Enter a new flight number for the clone.
            </DialogDescription>
          </DialogHeader>
          <div style={{ padding: '8px 0' }}>
            <Input
              value={cloneFlightNumber}
              onChange={(e) => setCloneFlightNumber(e.target.value.toUpperCase())}
              placeholder="SMA200"
              className="font-mono"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleCloneSubmit(); }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCloneDialogSchedule(null)}
              disabled={cloneLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleCloneSubmit} disabled={cloneLoading || !cloneFlightNumber.trim()}>
              {cloneLoading ? 'Cloning...' : 'Clone'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteSchedule} onOpenChange={(open) => { if (!open) setDeleteSchedule(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Schedule</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete{' '}
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono, monospace)' }}>
                {deleteSchedule?.flightNumber}
              </span>{' '}
              ({deleteSchedule?.depIcao} - {deleteSchedule?.arrIcao})?
              This will also remove any active bids on this route.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteSchedule(null)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
