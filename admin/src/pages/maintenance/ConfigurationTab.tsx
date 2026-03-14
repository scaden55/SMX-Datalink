import React, { useState } from 'react';
import { CheckSchedulesSection } from './CheckSchedulesSection';

// ═══════════════════════════════════════════════════════════════
// Configuration Tab — Check Schedules / MEL Master / Components
// ═══════════════════════════════════════════════════════════════

export function ConfigurationTab() {
  const [subTab, setSubTab] = useState<'schedules' | 'melMaster' | 'components'>('schedules');
  const [refreshKey, setRefreshKey] = useState(0);

  const subTabs: { key: typeof subTab; label: string }[] = [
    { key: 'schedules', label: 'Check Schedules' },
    { key: 'melMaster', label: 'MEL Master' },
    { key: 'components', label: 'Components' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Sub-tab bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          padding: '0 24px',
          borderBottom: '1px solid var(--border-primary)',
        }}
      >
        {subTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSubTab(tab.key)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: subTab === tab.key ? '2px solid var(--accent-blue)' : '2px solid transparent',
              padding: '8px 16px',
              fontSize: 12,
              fontWeight: 500,
              color: subTab === tab.key ? 'var(--accent-blue-bright)' : 'var(--text-tertiary)',
              cursor: 'pointer',
              transition: 'color 120ms',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {subTab === 'schedules' && (
          <CheckSchedulesSection refreshKey={refreshKey} />
        )}
        {subTab === 'melMaster' && (
          <div style={{ padding: 24, color: 'var(--text-tertiary)', fontSize: 13 }}>
            MEL Master List — coming soon
          </div>
        )}
        {subTab === 'components' && (
          <div style={{ padding: 24, color: 'var(--text-tertiary)', fontSize: 13 }}>
            Components — coming soon
          </div>
        )}
      </div>
    </div>
  );
}
