import { useState, useEffect } from 'react';
import { Settings, Save, Loader2, Check } from 'lucide-react';
import { api } from '../lib/api';

export function SettingsPage() {
  const [simbriefUsername, setSimbriefUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get<{ simbriefUsername: string | null }>('/api/profile/simbrief')
      .then((data) => {
        setSimbriefUsername(data.simbriefUsername ?? '');
      })
      .catch((err) => console.error('[Settings] Failed to load SimBrief username:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.put('/api/profile/simbrief', { simbriefUsername });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
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
            <h2 className="text-sm font-semibold text-acars-text">SimBrief Integration</h2>
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
                className="flex-1 rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-3 py-2 font-mono outline-none focus:border-acars-blue transition-colors placeholder:text-acars-muted/50 disabled:opacity-50"
              />
              <button
                onClick={handleSave}
                disabled={saving || loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-[11px] font-semibold bg-acars-blue/10 text-acars-blue border border-acars-blue/20 hover:bg-acars-blue/20 transition-colors disabled:opacity-50"
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
              <span className="text-acars-cyan">simbrief.com</span> under Account Settings.
              This is used to fetch your latest OFP on the Flight Planning page.
            </p>
          </div>
        </div>

        {/* Placeholder sections for future settings */}
        <div className="panel">
          <div className="px-4 py-3 border-b border-acars-border">
            <h2 className="text-sm font-semibold text-acars-text">General</h2>
          </div>
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-acars-muted">General settings coming soon</p>
          </div>
        </div>

        <div className="panel">
          <div className="px-4 py-3 border-b border-acars-border">
            <h2 className="text-sm font-semibold text-acars-text">Simulator</h2>
          </div>
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-acars-muted">Simulator connection settings coming soon</p>
          </div>
        </div>

        <div className="panel">
          <div className="px-4 py-3 border-b border-acars-border">
            <h2 className="text-sm font-semibold text-acars-text">Notifications</h2>
          </div>
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-acars-muted">Notification preferences coming soon</p>
          </div>
        </div>
      </div>
    </div>
  );
}
