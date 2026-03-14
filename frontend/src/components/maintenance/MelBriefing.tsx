import { useState, useEffect } from 'react';
import { Warning, CheckCircle } from '@phosphor-icons/react';
import { api } from '../../lib/api';
import { toast } from '../../stores/toastStore';
import { Button } from '../ui/button';

interface MelBriefingProps {
  aircraftId: number;
  onAcknowledge: () => void;
}

interface MelItem {
  id: number;
  itemNumber: string;
  title: string;
  category: string;
  ataChapter: string;
  ata_chapter_title: string;
  deferralDate: string;
  expiryDate: string;
  placardInfo: string | null;
  operationsProcedure: string | null;
  remarks: string | null;
}

interface MelBriefingResponse {
  aircraftId: number;
  registration: string;
  activeMels: MelItem[];
}

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-400/30' },
  B: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-400/30' },
  C: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-400/30' },
  D: { bg: 'bg-zinc-500/15', text: 'text-zinc-400', border: 'border-zinc-400/30' },
};

function getCategoryStyle(cat: string) {
  return CATEGORY_STYLES[cat.toUpperCase()] ?? CATEGORY_STYLES.D;
}

export function MelBriefing({ aircraftId, onAcknowledge }: MelBriefingProps) {
  const [data, setData] = useState<MelBriefingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [acknowledging, setAcknowledging] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<MelBriefingResponse>(`/api/aircraft/${aircraftId}/mel-briefing`)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        /* no MEL data — will render null */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [aircraftId]);

  const handleAcknowledge = async () => {
    setAcknowledging(true);
    try {
      await api.post(`/api/aircraft/${aircraftId}/mel-briefing/ack`);
      onAcknowledge();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to acknowledge';
      toast.error(message);
    } finally {
      setAcknowledging(false);
    }
  };

  if (loading) return null;
  if (!data || data.activeMels.length === 0) return null;

  const mels = data.activeMels;

  return (
    <div className="flex flex-col gap-3">
      {/* Warning banner */}
      <div className="flex items-center gap-2.5 rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-2.5">
        <Warning className="h-5 w-5 shrink-0 text-amber-400" weight="fill" />
        <span className="text-[12px] font-semibold text-amber-300">
          This aircraft has {mels.length} active MEL deferral{mels.length !== 1 ? 's' : ''}.
          Review before departure.
        </span>
      </div>

      {/* MEL cards */}
      <div className="flex flex-col gap-2">
        {mels.map((mel) => {
          const style = getCategoryStyle(mel.category);
          return (
            <div
              key={mel.id}
              className="rounded-md border border-acars-border bg-acars-panel p-3"
            >
              <div className="flex items-start gap-3">
                {/* Category badge */}
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-sm font-bold ${style.bg} ${style.text} ${style.border}`}
                >
                  {mel.category.toUpperCase()}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  {/* Item number + title */}
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[12px] font-semibold text-acars-text">
                      {mel.itemNumber}
                    </span>
                    <span className="text-[12px] text-acars-text">
                      {mel.title}
                    </span>
                  </div>

                  {/* ATA chapter */}
                  <span className="text-[11px] text-acars-muted">
                    ATA {mel.ataChapter} — {mel.ata_chapter_title}
                  </span>

                  {/* Placard info */}
                  {mel.placardInfo && (
                    <div className="rounded border border-amber-400/20 bg-amber-500/5 px-2 py-1 text-[11px] text-amber-300">
                      Placard: {mel.placardInfo}
                    </div>
                  )}

                  {/* Operations procedure */}
                  {mel.operationsProcedure && (
                    <div className="text-[11px] text-acars-muted">
                      <span className="font-semibold text-acars-text">Crew action: </span>
                      {mel.operationsProcedure}
                    </div>
                  )}

                  {/* Dates */}
                  <div className="flex items-center gap-3 text-[11px] text-acars-muted">
                    <span>
                      Deferred: {new Date(mel.deferralDate).toLocaleDateString()}
                    </span>
                    <span>
                      Expires: {new Date(mel.expiryDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Acknowledge button */}
      <Button
        onClick={handleAcknowledge}
        disabled={acknowledging}
        className="w-full"
      >
        <CheckCircle className="h-4 w-4" weight="bold" />
        {acknowledging ? 'Acknowledging...' : 'I have reviewed all MEL items'}
      </Button>
    </div>
  );
}
