import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { api } from '../lib/api';
import { toast } from '../stores/toastStore';
import type { FlightPlanFormData, FlightPlanPhase, DispatchEditPayload } from '@acars/shared';

interface DispatchEditContextValue {
  canEdit: boolean;
  canEditFuel: boolean;
  canEditRoute: boolean;
  canEditMEL: boolean;
  canEditRemarks: boolean;
  isOwnFlight: boolean;
  phase: FlightPlanPhase;
  bidId: number | null;
  editableFields: Partial<FlightPlanFormData>;
  onFieldChange: (key: string, value: string) => void;
  saving: boolean;
  lastSavedAt: Date | null;
  hasUnreleasedChanges: boolean;
  releasing: boolean;
  releaseDispatch: () => Promise<void>;
  /** Fields changed in the last dispatcher release (pilot sees these highlighted) */
  releasedFields: string[] | null;
  /** Pilot acknowledges released changes, clearing highlights */
  acknowledgeRelease: () => Promise<void>;
}

const DispatchEditContext = createContext<DispatchEditContextValue>({
  canEdit: false,
  canEditFuel: false,
  canEditRoute: false,
  canEditMEL: false,
  canEditRemarks: false,
  isOwnFlight: false,
  phase: 'planning',
  bidId: null,
  editableFields: {},
  onFieldChange: () => {},
  saving: false,
  lastSavedAt: null,
  hasUnreleasedChanges: false,
  releasing: false,
  releaseDispatch: async () => {},
  releasedFields: null,
  acknowledgeRelease: async () => {},
});

export function useDispatchEdit() {
  return useContext(DispatchEditContext);
}

interface DispatchEditProviderProps {
  children: ReactNode;
  bidId: number | null;
  phase: FlightPlanPhase;
  isAdmin: boolean;
  isOwnFlight: boolean;
  flightPlanData: FlightPlanFormData | null;
  releasedFields: string[] | null;
}

export function DispatchEditProvider({ children, bidId, phase, isAdmin, isOwnFlight, flightPlanData, releasedFields: releasedFieldsProp }: DispatchEditProviderProps) {
  const [editableFields, setEditableFields] = useState<Partial<FlightPlanFormData>>({});
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const dirtyFieldsRef = useRef<Partial<DispatchEditPayload>>({});
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bidIdRef = useRef(bidId);
  const pendingReleaseFieldsRef = useRef<Set<string>>(new Set());
  const [hasUnreleasedChanges, setHasUnreleasedChanges] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [releasedFields, setReleasedFields] = useState<string[] | null>(releasedFieldsProp);

  // Compute permission booleans
  const isCompleted = phase === 'completed';
  const canEdit = isAdmin && !isCompleted;
  const canEditFuel = isAdmin && phase === 'planning';
  const canEditRoute = canEdit;
  const canEditMEL = canEdit;
  const canEditRemarks = canEdit;

  // Sync releasedFields when prop changes (WebSocket update or new flight)
  useEffect(() => {
    setReleasedFields(releasedFieldsProp);
  }, [releasedFieldsProp]);

  // Sync editableFields when flight selection / data changes
  useEffect(() => {
    bidIdRef.current = bidId;
    setEditableFields(flightPlanData ?? {});
    dirtyFieldsRef.current = {};
    pendingReleaseFieldsRef.current = new Set();
    setHasUnreleasedChanges(false);
    setLastSavedAt(null);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, [bidId, flightPlanData]);

  // Auto-save: debounce 1.5s, PATCH dirty fields
  const flush = useCallback(async () => {
    const currentBidId = bidIdRef.current;
    const fields = { ...dirtyFieldsRef.current };
    dirtyFieldsRef.current = {};

    if (!currentBidId || Object.keys(fields).length === 0) return;

    setSaving(true);
    try {
      await api.patch(`/api/dispatch/flights/${currentBidId}`, fields);
      setLastSavedAt(new Date());
    } catch (err) {
      console.error('[DispatchEdit] Auto-save failed:', err);
      toast.error('Failed to save dispatch changes');
    } finally {
      setSaving(false);
    }
  }, []);

  const onFieldChange = useCallback((key: string, value: string) => {
    setEditableFields((prev) => ({ ...prev, [key]: value }));
    dirtyFieldsRef.current[key as keyof DispatchEditPayload] = value;
    pendingReleaseFieldsRef.current.add(key);
    setHasUnreleasedChanges(true);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(flush, 1500);
  }, [flush]);

  const releaseDispatch = useCallback(async () => {
    const currentBidId = bidIdRef.current;
    if (!currentBidId || pendingReleaseFieldsRef.current.size === 0) return;

    // Flush any pending auto-save first
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      await flush();
    }

    const changedFields = Array.from(pendingReleaseFieldsRef.current);
    setReleasing(true);
    try {
      await api.post(`/api/dispatch/flights/${currentBidId}/release`, { changedFields });
      pendingReleaseFieldsRef.current = new Set();
      setHasUnreleasedChanges(false);
      toast.success('Dispatch released to pilot');
    } catch (err) {
      console.error('[DispatchEdit] Release failed:', err);
      toast.error('Failed to release dispatch');
    } finally {
      setReleasing(false);
    }
  }, [flush]);

  const acknowledgeRelease = useCallback(async () => {
    const currentBidId = bidIdRef.current;
    if (!currentBidId) return;

    try {
      await api.post(`/api/dispatch/flights/${currentBidId}/acknowledge`);
      setReleasedFields(null);
    } catch (err) {
      console.error('[DispatchEdit] Acknowledge failed:', err);
      toast.error('Failed to acknowledge changes');
    }
  }, []);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        flush();
      }
    };
  }, [flush]);

  return (
    <DispatchEditContext.Provider
      value={{
        canEdit,
        canEditFuel,
        canEditRoute,
        canEditMEL,
        canEditRemarks,
        isOwnFlight,
        phase,
        bidId,
        editableFields,
        onFieldChange,
        saving,
        lastSavedAt,
        hasUnreleasedChanges,
        releasing,
        releaseDispatch,
        releasedFields,
        acknowledgeRelease,
      }}
    >
      {children}
    </DispatchEditContext.Provider>
  );
}
