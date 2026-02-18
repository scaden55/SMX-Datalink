import { Settings } from 'lucide-react';

export function SettingsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-4">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-acars-muted/10 border border-acars-muted/20">
        <Settings className="w-8 h-8 text-acars-muted" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-acars-text">Settings</h2>
        <p className="text-sm text-acars-muted mt-1">General, Simulator, Network, Notifications, Appearance, Account</p>
      </div>
    </div>
  );
}
