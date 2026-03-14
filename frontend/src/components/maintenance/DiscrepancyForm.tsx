import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../lib/api';
import { toast } from '../../stores/toastStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

interface DiscrepancyFormProps {
  open: boolean;
  onClose: () => void;
  aircraftId?: number;
  aircraftRegistration?: string;
  flightNumber?: string;
}

interface AtaChapter {
  chapter: string;
  title: string;
}

const FLIGHT_PHASES = [
  'Preflight',
  'Taxi Out',
  'Takeoff',
  'Climb',
  'Cruise',
  'Descent',
  'Approach',
  'Landing',
  'Taxi In',
  'Parked',
] as const;

export function DiscrepancyForm({
  open,
  onClose,
  aircraftId,
  aircraftRegistration,
  flightNumber,
}: DiscrepancyFormProps) {
  const [ataChapters, setAtaChapters] = useState<AtaChapter[]>([]);
  const [ataQuery, setAtaQuery] = useState('');
  const [selectedAta, setSelectedAta] = useState('');
  const [showAtaDropdown, setShowAtaDropdown] = useState(false);
  const [description, setDescription] = useState('');
  const [flightPhase, setFlightPhase] = useState('');
  const [severity, setSeverity] = useState<'non_grounding' | 'grounding'>('non_grounding');
  const [submitting, setSubmitting] = useState(false);
  const ataRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    api
      .get<{ chapters: AtaChapter[] }>('/api/ata-chapters')
      .then((res) => setAtaChapters(res.chapters))
      .catch(() => {
        /* ignore — chapters optional */
      });
  }, [open]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setAtaQuery('');
      setSelectedAta('');
      setDescription('');
      setFlightPhase('');
      setSeverity('non_grounding');
    }
  }, [open]);

  // Close ATA dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ataRef.current && !ataRef.current.contains(e.target as Node)) {
        setShowAtaDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filteredChapters = ataChapters.filter((ch) => {
    const q = ataQuery.toLowerCase();
    return (
      ch.chapter.toLowerCase().includes(q) ||
      ch.title.toLowerCase().includes(q)
    );
  });

  const handleSelectAta = useCallback((ch: AtaChapter) => {
    setSelectedAta(ch.chapter);
    setAtaQuery(`${ch.chapter} — ${ch.title}`);
    setShowAtaDropdown(false);
  }, []);

  const handleSubmit = async () => {
    if (!selectedAta) {
      toast.error('Please select an ATA chapter');
      return;
    }
    if (description.trim().length < 10) {
      toast.error('Description must be at least 10 characters');
      return;
    }
    if (!aircraftId) {
      toast.error('No aircraft selected');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/api/discrepancies', {
        aircraftId,
        flightNumber: flightNumber || undefined,
        ataChapter: selectedAta,
        description: description.trim(),
        flightPhase: flightPhase || undefined,
        severity,
      });
      toast.success('Discrepancy reported');
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Report Discrepancy</DialogTitle>
          <DialogDescription>
            Log an aircraft discrepancy for maintenance review.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 px-4 py-2">
          {/* Aircraft */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-acars-muted">
              Aircraft
            </label>
            {aircraftRegistration ? (
              <div className="flex h-8 items-center rounded-md border border-acars-border bg-acars-input px-2.5 text-[12px] text-acars-muted">
                {aircraftRegistration}
              </div>
            ) : (
              <Input placeholder="Registration" disabled />
            )}
          </div>

          {/* ATA Chapter — filterable dropdown */}
          <div className="flex flex-col gap-1" ref={ataRef}>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-acars-muted">
              ATA Chapter
            </label>
            <Input
              value={ataQuery}
              onChange={(e) => {
                setAtaQuery(e.target.value);
                setSelectedAta('');
                setShowAtaDropdown(true);
              }}
              onFocus={() => setShowAtaDropdown(true)}
              placeholder="Search chapter..."
            />
            {showAtaDropdown && filteredChapters.length > 0 && (
              <div className="relative">
                <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-acars-border bg-acars-panel shadow-xl">
                  {filteredChapters.map((ch) => (
                    <button
                      key={ch.chapter}
                      type="button"
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] text-acars-text hover:bg-acars-hover"
                      onClick={() => handleSelectAta(ch)}
                    >
                      <span className="font-mono font-semibold text-blue-400">
                        {ch.chapter}
                      </span>
                      <span className="text-acars-muted">{ch.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-acars-muted">
              Description
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the discrepancy..."
              rows={4}
            />
            {description.length > 0 && description.length < 10 && (
              <span className="text-[11px] text-red-400">
                Minimum 10 characters ({description.length}/10)
              </span>
            )}
          </div>

          {/* Flight Phase */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-acars-muted">
              Flight Phase (optional)
            </label>
            <Select value={flightPhase} onValueChange={setFlightPhase}>
              <SelectTrigger>
                <SelectValue placeholder="Select phase..." />
              </SelectTrigger>
              <SelectContent>
                {FLIGHT_PHASES.map((phase) => (
                  <SelectItem key={phase} value={phase}>
                    {phase}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Severity */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-acars-muted">
              Severity
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                className={`flex-1 rounded-md border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                  severity === 'non_grounding'
                    ? 'border-blue-400/40 bg-blue-500/15 text-blue-400'
                    : 'border-acars-border bg-transparent text-acars-muted hover:bg-acars-hover'
                }`}
                onClick={() => setSeverity('non_grounding')}
              >
                Non-Grounding
              </button>
              <button
                type="button"
                className={`flex-1 rounded-md border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                  severity === 'grounding'
                    ? 'border-red-400/40 bg-red-500/15 text-red-400'
                    : 'border-acars-border bg-transparent text-acars-muted hover:bg-acars-hover'
                }`}
                onClick={() => setSeverity('grounding')}
              >
                Grounding
              </button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
