import { useState, useEffect, useRef } from 'react';
import { Settings, Save, Loader2, Check, Monitor, Bell } from 'lucide-react';
import { api } from '../lib/api';

export function SettingsPage() {
  const [simbriefUsername, setSimbriefUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadError, setLoadError] = useState('');
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let cancelled = false;
    api.get<{ simbriefUsername: string | null }>('/api/profile/simbrief')
      .then((data) => {
        if (!cancelled) setSimbriefUsername(data.simbriefUsername ?? '');
      })
      .catch((err) => {
        if (!cancelled) setLoadError('Failed to load settings');
        console.error('[Settings] Failed to load SimBrief username:', err);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Clean up saved timer on unmount
  useEffect(() => {
    return () => { clearTimeout(savedTimerRef.current); };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.put('/api/profile/simbrief', { simbriefUsername });
      setSaved(true);
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('[Settings] Failed to save SimBrief username:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="max-w-2xl mx-auto w-full p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <img src="/logos/chevron-light.png" alt="SMA" className="h-9 w-auto opacity-40" />
          <div>
            <h1 className="text-lg font-semibold text-acars-text">Settings</h1>
            <p className="text-xs text-acars-muted">Configure your ACARS preferences</p>
          </div>
        </div>

        {/* SimBrief Section */}
        <div className="panel">
          <div className="px-4 py-3 border-b border-acars-border">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-acars-muted" />
              <h2 className="text-sm font-semibold text-acars-text">SimBrief Integration</h2>
            </div>
            <p className="text-[11px] text-acars-muted mt-0.5">Connect your SimBrief account to auto-populate flight plans</p>
          </div>
          <div className="px-4 py-4">
            <label className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1.5 block">
              SimBrief Username / Pilot ID
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={simbriefUsername}
                onChange={(e) => setSimbriefUsername(e.target.value)}
                placeholder={loading ? 'Loading...' : 'Enter your SimBrief username'}
                disabled={loading}
                className="input-field flex-1 text-[11px] font-mono"
              />
              <button
                onClick={handleSave}
                disabled={saving || loading}
                className="btn-secondary btn-md"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : saved ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                {saved ? 'Saved' : 'Save'}
              </button>
            </div>
            <p className="text-[10px] text-acars-muted mt-2">
              Find your username at{' '}
              <span className="text-sky-400">simbrief.com</span> under Account Settings.
              This is used to fetch your latest OFP on the Flight Planning page.
            </p>
          </div>
        </div>

        {/* Placeholder sections for future settings */}
        <div className="panel">
          <div className="px-4 py-3 border-b border-acars-border">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-acars-muted" />
              <h2 className="text-sm font-semibold text-acars-text">General</h2>
            </div>
          </div>
          <div className="px-4 py-8 text-center">
            <Settings className="w-6 h-6 text-acars-muted/20 mx-auto mb-2" />
            <p className="text-xs text-acars-muted/50">General settings coming soon</p>
          </div>
        </div>

        <div className="panel">
          <div className="px-4 py-3 border-b border-acars-border">
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-acars-muted" />
              <h2 className="text-sm font-semibold text-acars-text">Simulator</h2>
            </div>
          </div>
          <div className="px-4 py-8 text-center">
            <Monitor className="w-6 h-6 text-acars-muted/20 mx-auto mb-2" />
            <p className="text-xs text-acars-muted/50">Simulator connection settings coming soon</p>
          </div>
        </div>

        <div className="panel">
          <div className="px-4 py-3 border-b border-acars-border">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-acars-muted" />
              <h2 className="text-sm font-semibold text-acars-text">Notifications</h2>
            </div>
          </div>
          <div className="px-4 py-8 text-center">
            <Bell className="w-6 h-6 text-acars-muted/20 mx-auto mb-2" />
            <p className="text-xs text-acars-muted/50">Notification preferences coming soon</p>
          </div>
        </div>
      </div>
    </div>
  );
}
