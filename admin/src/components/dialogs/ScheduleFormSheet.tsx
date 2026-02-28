import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { SpinnerGap } from '@phosphor-icons/react';

// ── Types ───────────────────────────────────────────────────────

export interface ScheduleFormData {
  id?: number;
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
}

interface AutofillResult {
  depAirport?: { icao: string; name: string; municipality: string | null; country: string | null };
  arrAirport?: { icao: string; name: string; municipality: string | null; country: string | null };
  distanceNm?: number;
  flightTimeMin?: number;
  arrTime?: string;
  cruiseSpeed?: number;
}

interface ScheduleFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  /** Pass existing data to edit; null = create new */
  schedule: ScheduleFormData | null;
  /** If true, treat as a clone (create new, not update) */
  isClone?: boolean;
}

const DAYS_OPTIONS = [
  { value: '0', label: 'Sun' },
  { value: '1', label: 'Mon' },
  { value: '2', label: 'Tue' },
  { value: '3', label: 'Wed' },
  { value: '4', label: 'Thu' },
  { value: '5', label: 'Fri' },
  { value: '6', label: 'Sat' },
];

const DEFAULT_FORM: ScheduleFormData = {
  flightNumber: '',
  depIcao: '',
  arrIcao: '',
  aircraftType: 'Cargo',
  depTime: '',
  arrTime: '',
  distanceNm: 0,
  flightTimeMin: 0,
  daysOfWeek: '0123456',
  isActive: true,
};

function formatFlightTime(minutes: number): string {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export function ScheduleFormSheet({ open, onOpenChange, onSaved, schedule, isClone }: ScheduleFormSheetProps) {
  const isEditing = !!schedule?.id && !isClone;
  const [form, setForm] = useState<ScheduleFormData>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [autofillLoading, setAutofillLoading] = useState(false);
  const [depAirportName, setDepAirportName] = useState('');
  const [arrAirportName, setArrAirportName] = useState('');

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (schedule) {
        setForm({
          ...schedule,
          // For clone, clear the ID and append "(Copy)" hint to flight number
          ...(isClone ? { id: undefined, flightNumber: '' } : {}),
        });
        setDepAirportName('');
        setArrAirportName('');
      } else {
        setForm(DEFAULT_FORM);
        setDepAirportName('');
        setArrAirportName('');
      }
    }
  }, [open, schedule, isClone]);

  function updateField<K extends keyof ScheduleFormData>(key: K, value: ScheduleFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ── Autofill ──────────────────────────────────────────────────

  const doAutofill = useCallback(async (depIcao: string, arrIcao: string, aircraftType: string, depTime: string) => {
    if (depIcao.length < 3 && arrIcao.length < 3) return;
    setAutofillLoading(true);
    try {
      const params = new URLSearchParams();
      if (depIcao) params.set('depIcao', depIcao.toUpperCase());
      if (arrIcao) params.set('arrIcao', arrIcao.toUpperCase());
      if (aircraftType) params.set('aircraftType', aircraftType);
      if (depTime) params.set('depTime', depTime);

      const result = await api.get<AutofillResult>(`/api/admin/schedules/autofill?${params}`);

      if (result.depAirport) {
        setDepAirportName(`${result.depAirport.name}${result.depAirport.municipality ? `, ${result.depAirport.municipality}` : ''}`);
      }
      if (result.arrAirport) {
        setArrAirportName(`${result.arrAirport.name}${result.arrAirport.municipality ? `, ${result.arrAirport.municipality}` : ''}`);
      }

      setForm((prev) => ({
        ...prev,
        ...(result.distanceNm != null ? { distanceNm: Math.round(result.distanceNm) } : {}),
        ...(result.flightTimeMin != null ? { flightTimeMin: result.flightTimeMin } : {}),
        ...(result.arrTime ? { arrTime: result.arrTime } : {}),
      }));
    } catch {
      // Silently fail — autofill is a convenience, not required
    } finally {
      setAutofillLoading(false);
    }
  }, []);

  function handleIcaoBlur() {
    doAutofill(form.depIcao, form.arrIcao, form.aircraftType, form.depTime);
  }

  // ── Days of Week toggle ────────────────────────────────────────

  function toggleDay(day: string) {
    setForm((prev) => {
      const days = prev.daysOfWeek;
      const newDays = days.includes(day)
        ? days.replace(day, '')
        : [...days.split(''), day].sort().join('');
      return { ...prev, daysOfWeek: newDays };
    });
  }

  // ── Submit ─────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.flightNumber || !form.depIcao || !form.arrIcao || !form.aircraftType || !form.depTime || !form.arrTime) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        flightNumber: form.flightNumber.toUpperCase(),
        depIcao: form.depIcao.toUpperCase(),
        arrIcao: form.arrIcao.toUpperCase(),
        aircraftType: form.aircraftType,
        depTime: form.depTime,
        arrTime: form.arrTime,
        distanceNm: form.distanceNm,
        flightTimeMin: form.flightTimeMin,
        daysOfWeek: form.daysOfWeek,
        isActive: form.isActive,
      };

      if (isEditing) {
        await api.patch(`/api/admin/schedules/${schedule!.id}`, payload);
        toast.success('Schedule updated');
      } else {
        await api.post('/api/admin/schedules', payload);
        toast.success(isClone ? 'Schedule cloned' : 'Schedule created');
      }

      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to save schedule');
    } finally {
      setSubmitting(false);
    }
  }

  const title = isEditing ? 'Edit Schedule' : isClone ? 'Clone Schedule' : 'Add Schedule';
  const description = isEditing
    ? `Editing ${schedule?.flightNumber}`
    : isClone
      ? `Create a copy of ${schedule?.flightNumber}`
      : 'Add a new scheduled flight.';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* Flight Number */}
          <div className="space-y-2">
            <Label htmlFor="sched-flight-number">Flight Number *</Label>
            <Input
              id="sched-flight-number"
              value={form.flightNumber}
              onChange={(e) => updateField('flightNumber', e.target.value.toUpperCase())}
              placeholder="SMA100"
              required
              className="font-mono"
            />
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label htmlFor="sched-type">Type *</Label>
            <Select value={form.aircraftType} onValueChange={(v) => { updateField('aircraftType', v); }}>
              <SelectTrigger id="sched-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Cargo">Cargo</SelectItem>
                <SelectItem value="Passenger">Passenger</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Departure / Arrival ICAO */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sched-dep">Departure ICAO *</Label>
              <Input
                id="sched-dep"
                value={form.depIcao}
                onChange={(e) => updateField('depIcao', e.target.value.toUpperCase())}
                onBlur={handleIcaoBlur}
                placeholder="KMIA"
                maxLength={4}
                required
                className="font-mono"
              />
              {depAirportName && (
                <p className="text-xs text-muted-foreground truncate">{depAirportName}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sched-arr">Arrival ICAO *</Label>
              <Input
                id="sched-arr"
                value={form.arrIcao}
                onChange={(e) => updateField('arrIcao', e.target.value.toUpperCase())}
                onBlur={handleIcaoBlur}
                placeholder="KJFK"
                maxLength={4}
                required
                className="font-mono"
              />
              {arrAirportName && (
                <p className="text-xs text-muted-foreground truncate">{arrAirportName}</p>
              )}
            </div>
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sched-dep-time">Departure Time (UTC) *</Label>
              <Input
                id="sched-dep-time"
                value={form.depTime}
                onChange={(e) => updateField('depTime', e.target.value)}
                onBlur={handleIcaoBlur}
                placeholder="08:00"
                required
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sched-arr-time">Arrival Time (UTC) *</Label>
              <Input
                id="sched-arr-time"
                value={form.arrTime}
                onChange={(e) => updateField('arrTime', e.target.value)}
                placeholder="12:30"
                required
                className="font-mono"
              />
            </div>
          </div>

          {/* Distance / Flight Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sched-distance">
                Distance (nm)
                {autofillLoading && <SpinnerGap size={12} className="inline ml-1 animate-spin" />}
              </Label>
              <Input
                id="sched-distance"
                type="number"
                min={0}
                value={form.distanceNm || ''}
                onChange={(e) => updateField('distanceNm', parseInt(e.target.value) || 0)}
                placeholder="0"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sched-ftime">Flight Time (min)</Label>
              <Input
                id="sched-ftime"
                type="number"
                min={0}
                value={form.flightTimeMin || ''}
                onChange={(e) => updateField('flightTimeMin', parseInt(e.target.value) || 0)}
                placeholder="0"
                className="font-mono"
              />
              {form.flightTimeMin > 0 && (
                <p className="text-xs text-muted-foreground">{formatFlightTime(form.flightTimeMin)}</p>
              )}
            </div>
          </div>

          {/* Days of Week */}
          <div className="space-y-2">
            <Label>Days of Week</Label>
            <div className="flex gap-1.5">
              {DAYS_OPTIONS.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  className={`
                    flex h-8 w-9 items-center justify-center rounded-md text-xs font-medium transition-colors
                    ${form.daysOfWeek.includes(day.value)
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'bg-muted text-muted-foreground border border-transparent hover:border-border'
                    }
                  `}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between rounded-md border px-4 py-3">
            <div>
              <Label htmlFor="sched-active" className="text-sm font-medium">Active</Label>
              <p className="text-xs text-muted-foreground">Schedule visible to pilots for booking</p>
            </div>
            <Switch
              id="sched-active"
              checked={form.isActive}
              onCheckedChange={(checked) => updateField('isActive', checked)}
            />
          </div>

          {/* Footer */}
          <SheetFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? 'Saving...'
                : isEditing ? 'Update Schedule' : isClone ? 'Clone Schedule' : 'Create Schedule'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
